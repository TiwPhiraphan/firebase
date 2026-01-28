import { GoogleAuth, type AuthClient } from 'google-auth-library'

export type Credentials = {
    readonly type?: string
    readonly auth_uri?: string
    readonly token_uri?: string
    readonly client_id?: string
    readonly project_id: string
    readonly private_key: string
    readonly client_email: string
    readonly private_key_id?: string
    readonly universe_domain?: string
    readonly client_x509_cert_url?: string
    readonly auth_provider_x509_cert_url?: string
}

type MaybePromise<T> = T | Promise<T>
type Maybe<T> = T | undefined
type AsyncMaybe<T> = MaybePromise<Maybe<T>>

export type TokenCacheModel = {
    token: string
    exp: number
}

export type FirebaseProps = {
    credentials: Credentials
    database: string
    cache?: {
        get: () => AsyncMaybe<TokenCacheModel>
        set: (model: TokenCacheModel) => MaybePromise<void>
    }
}

export class FirebaseSDK {
    private cache?: FirebaseProps['cache']
    private databaseUrl: string
    private auth: GoogleAuth<AuthClient>
    private storage: TokenCacheModel = { token: '', exp: 0 }
    private pending?: Promise<string>

    private async getAccessToken(): Promise<string> {
        const now = Date.now()
        if (this.pending) return this.pending
        if (!this.storage.token || now > this.storage.exp) {
            this.pending = (async () => {
                try {
                    if (typeof this.cache?.get === 'function') {
                        try {
                            const c = await this.cache.get()
                            if (c && now < c.exp) {
                                this.storage = c
                                return c.token
                            }
                        } catch {}
                    }
                    const token = await this.auth.getAccessToken() as string
                    const exp = now + 33e5
                    this.storage = { token, exp }
                    if (typeof this.cache?.set === 'function') {
                        try {
                            await this.cache.set({ token, exp })
                        } catch {}
                    }
                    return token
                } finally {
                    this.pending = undefined
                }
            })()
            return this.pending
        }
        return this.storage.token
    }

    private buildUrl(path: string, params?: URLSearchParams): string {
        const cleanPath = path.replace(/^\/+|\/+$/g, '')
        const url = `https://${this.databaseUrl}/${cleanPath}.json`
        return params ? `${url}?${params}` : url
    }

    constructor(options: FirebaseProps) {
        this.cache = options.cache
        
        // รองรับทั้ง URL เต็มและแค่ชื่อ database
        const db = options.database.replace(/^https?:\/\//, '').replace(/\/$/, '')
        this.databaseUrl = db.includes('.') ? db : `${db}.firebaseio.com`

        const { private_key, ...credentials } = options.credentials

        this.auth = new GoogleAuth({
            credentials: {
                ...credentials,
                private_key: private_key.replace(/\\n/g, '\n')
            },
            scopes: [
                'https://www.googleapis.com/auth/firebase.database',
                'https://www.googleapis.com/auth/userinfo.email'
            ]
        })
    }

    /* ------------------
       FirebaseSDK API
    --------------------- */
    
    /**
     * อ่านข้อมูลจาก path
     */
    async get<T = any>(path: string): Promise<T | null> {
        const token = await this.getAccessToken()
        const url = this.buildUrl(path)
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) {
            throw new Error(`Firebase get failed: [${response.statusText}] ${await response.text()}`)
        }
        return response.json() as T
    }

    /**
     * เขียนข้อมูลไปที่ path (overwrite)
     */
    async set<T = any>(path: string, data: T): Promise<void> {
        const token = await this.getAccessToken()
        const url = this.buildUrl(path)
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            throw new Error(`Firebase set failed: [${response.statusText}] ${await response.text()}`)
        }
    }

    /**
     * อัพเดทข้อมูล (merge)
     */
    async update<T = any>(path: string, data: Partial<T>): Promise<void> {
        const token = await this.getAccessToken()
        const url = this.buildUrl(path)
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            throw new Error(`Firebase update failed: [${response.statusText}] ${await response.text()}`)
        }
    }

    /**
     * ลบข้อมูล
     */
    async delete(path: string): Promise<void> {
        const token = await this.getAccessToken()
        const url = this.buildUrl(path)
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) {
            throw new Error(`Firebase delete failed: [${response.statusText}] ${await response.text()}`)
        }
    }

    /**
     * เพิ่มข้อมูลใหม่ (auto-generate key)
     */
    async push<T = any>(path: string, data: T): Promise<string> {
        const token = await this.getAccessToken()
        const url = this.buildUrl(path)
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            throw new Error(`Firebase push failed: [${response.statusText}] ${await response.text()}`)
        }
        const result = await response.json() as { name: string }
        return result.name
    }
    
    /**
     * ดึงเฉพาะ keys (shallow query)
     */
    async keys(path: string, reverse = false): Promise<string[]> {
        const token = await this.getAccessToken()
        const params = new URLSearchParams()
        params.set('shallow', 'true')
        const url = this.buildUrl(path, params)
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) {
            throw new Error(`Firebase query failed: [${response.statusText}] ${await response.text()}`)
        }
        const data = await response.json() as Record<string, boolean> | null
        if (!data || typeof data !== 'object') {
            return []
        }
        const keys = Object.keys(data)
        return reverse ? keys.sort().reverse() : keys.sort()
    }

    /**
     * นับจำนวน children ใน path
     */
    async count(path: string): Promise<number> {
        const keys = await this.keys(path)
        return keys.length
    }

    /**
     * Query ข้อมูลแบบ advanced
     */
    async query<T = any>(path: string, options: {
        orderBy?: string
        limitToFirst?: number
        limitToLast?: number
        startAt?: string | number
        endAt?: string | number
        startAfter?: string | number
        endBefore?: string | number
        equalTo?: string | number
    }): Promise<Record<string, T> | null> {
        const token = await this.getAccessToken()
        const params = new URLSearchParams()
        if (options.orderBy) params.set('orderBy', JSON.stringify(options.orderBy))
        if (options.limitToFirst) params.set('limitToFirst', String(options.limitToFirst))
        if (options.limitToLast) params.set('limitToLast', String(options.limitToLast))
        if (options.startAt !== undefined) params.set('startAt', JSON.stringify(options.startAt))
        if (options.endAt !== undefined) params.set('endAt', JSON.stringify(options.endAt))
        if (options.startAfter !== undefined) params.set('startAfter', JSON.stringify(options.startAfter))
        if (options.endBefore !== undefined) params.set('endBefore', JSON.stringify(options.endBefore))
        if (options.equalTo !== undefined) params.set('equalTo', JSON.stringify(options.equalTo))
        const url = this.buildUrl(path, params)
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) {
            throw new Error(`Firebase query failed: [${response.statusText}] ${await response.text()}`)
        }
        return response.json() as Promise<Record<string, T> | null>
    }

    /**
     * Transaction - อัพเดทข้อมูลแบบ atomic
     */
    async transaction<T = any>(
        path: string,
        updateFn: (current: T | null) => T | null
    ): Promise<T | null> {
        const current = await this.get<T>(path)
        const updated = updateFn(current)
        if (updated === null) {
            await this.delete(path)
            return null
        }
        await this.set(path, updated)
        return updated
    }

    /**
     * Increment/Decrement ค่าตัวเลข
     */
    async increment(path: string, delta: number = 1): Promise<number> {
        const result = await this.transaction<number>(path, (current) => {
            return (current || 0) + delta
        })
        return result || 0
    }

    /**
     * Cursor-based pagination (เร็วที่สุด)
     */
    async paginate<T = any>(
        path: string,
        pageSize: number,
        cursor?: string,
        reverse: boolean = false
    ): Promise<{
        items: Array<{ key: string; value: T }>
        nextCursor: string | null
        prevCursor: string | null
        hasMore: boolean
    }> {
        const data = await this.query<T>(path, {
            orderBy: '$key',
            ...(reverse ? {
                limitToLast: pageSize + 1,
                ...(cursor && { endBefore: cursor })
            } : {
                limitToFirst: pageSize + 1,
                ...(cursor && { startAfter: cursor })
            })
        })
        if (!data || typeof data !== 'object') {
            return { items: [], nextCursor: null, prevCursor: null, hasMore: false }
        }
        let entries = Object.entries(data).map(([key, value]) => ({ key, value }))
        if (reverse) {
            entries = entries.reverse()
        }
        const hasMore = entries.length > pageSize
        const items = hasMore ? entries.slice(0, pageSize) : entries
        const nextCursor = items.length > 0 ? items[items.length - 1]!.key : null
        const prevCursor = items.length > 0 ? items[0]!.key : null
        return {
            items,
            nextCursor,
            prevCursor,
            hasMore
        }
    }

    /**
     * Cursor-based pagination พร้อม count
     * (ช้ากว่า paginate เล็กน้อย เพราะต้องนับ total)
     */
    async paginateWithCount<T = any>(
        path: string,
        pageSize: number,
        cursor?: string,
        reverse: boolean = false
    ): Promise<{
        items: Array<{ key: string; value: T }>
        nextCursor: string | null
        prevCursor: string | null
        hasMore: boolean
        total: number
    }> {
        const [result, total] = await Promise.all([
            this.paginate<T>(path, pageSize, cursor, reverse),
            this.count(path)
        ])
        
        return {
            ...result,
            total
        }
    }

    /**
     * Get top N items
     */
    async top<T = any>(
        path: string,
        count: number,
        orderByField: string = '$key'
    ): Promise<Array<{ key: string; value: T }>> {
        const data = await this.query<T>(path, {
            orderBy: orderByField,
            limitToLast: count
        })
        
        if (!data || typeof data !== 'object') {
            return []
        }
        
        return Object.entries(data)
            .map(([key, value]) => ({ key, value }))
            .reverse()
    }

    /**
     * Get bottom N items
     */
    async bottom<T = any>(
        path: string,
        count: number,
        orderByField: string = '$key'
    ): Promise<Array<{ key: string; value: T }>> {
        const data = await this.query<T>(path, {
            orderBy: orderByField,
            limitToFirst: count
        })
        
        if (!data || typeof data !== 'object') {
            return []
        }
        
        return Object.entries(data).map(([key, value]) => ({ key, value }))
    }

    /**
     * Find by exact value
     */
    async findByValue<T = any>(
        path: string,
        orderByField: string,
        value: string | number
    ): Promise<Array<{ key: string; value: T }>> {
        const data = await this.query<T>(path, {
            orderBy: orderByField,
            equalTo: value
        })
        
        if (!data || typeof data !== 'object') {
            return []
        }
        
        return Object.entries(data).map(([key, value]) => ({ key, value }))
    }

    /**
     * Get range of items
     */
    async range<T = any>(
        path: string,
        orderByField: string,
        startValue: string | number,
        endValue: string | number
    ): Promise<Array<{ key: string; value: T }>> {
        const data = await this.query<T>(path, {
            orderBy: orderByField,
            startAt: startValue,
            endAt: endValue
        })
        
        if (!data || typeof data !== 'object') {
            return []
        }
        
        return Object.entries(data).map(([key, value]) => ({ key, value }))
    }

    /**
     * Batch operations - ทำหลาย operations พร้อมกัน
     */
    async batch(operations: Array<{
        type: 'set' | 'update' | 'delete'
        path: string
        data?: any
    }>): Promise<void> {
        await Promise.all(
            operations.map(async (op) => {
                switch (op.type) {
                    case 'set':
                        return this.set(op.path, op.data)
                    case 'update':
                        return this.update(op.path, op.data)
                    case 'delete':
                        return this.delete(op.path)
                }
            })
        )
    }
}
