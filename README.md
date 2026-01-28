# Firebase Realtime Database SDK

Firebase Realtime Database SDK สำหรับ TypeScript/JavaScript ที่ใช้งานง่าย รวดเร็ว และมีฟีเจอร์ครบครัน

## ✨ Features

- 🚀 **เร็ว** - ใช้ Firebase REST API โดยตรง
- 📦 **เบา** - ไม่ต้องติดตั้ง firebase-admin
- 🔄 **Cursor-based Pagination** - Pagination แบบประหยัดทรัพยากร
- 💾 **Token Caching** - Cache access token เพื่อประสิทธิภาพ
- 🎯 **TypeScript** - Type-safe ทุก API
- 🛠️ **ครบครัน** - CRUD, Query, Transaction, Batch operations

## 📦 Installation

```bash
npm install google-auth-library
```

## 🚀 Quick Start

### Basic Setup

```typescript
import { FirebaseSDK } from './firebase-sdk'

const firebase = new FirebaseSDK({
  credentials: {
    project_id: 'your-project-id',
    private_key: 'your-private-key',
    client_email: 'your-client-email'
  },
  database: 'your-database-url' // หรือแค่ 'your-database-name'
})
```

### With Token Caching

```typescript
const tokenCache = {
  token: '',
  exp: 0
}

const firebase = new FirebaseSDK({
  credentials: { /* ... */ },
  database: 'your-database',
  cache: {
    get: () => tokenCache,
    set: (model) => {
      tokenCache.token = model.token
      tokenCache.exp = model.exp
    }
  }
})
```

## 📖 API Reference

### Basic Operations

#### get - อ่านข้อมูล

```typescript
const user = await firebase.get<User>('/users/user123')
console.log(user) // { name: 'John', age: 30 }
```

#### set - เขียนข้อมูล (overwrite)

```typescript
await firebase.set('/users/user123', {
  name: 'John Doe',
  age: 30,
  email: 'john@example.com'
})
```

#### update - อัพเดทข้อมูล (merge)

```typescript
await firebase.update('/users/user123', {
  age: 31
})
```

#### delete - ลบข้อมูล

```typescript
await firebase.delete('/users/user123')
```

#### push - เพิ่มข้อมูลใหม่ (auto-generate key)

```typescript
const newId = await firebase.push('/posts', {
  title: 'Hello World',
  content: 'My first post',
  createdAt: Date.now()
})
console.log(newId) // "-N1234567890"
```

### Query Operations

#### keys - ดึงเฉพาะ keys (ไม่โหลด values)

```typescript
const keys = await firebase.keys('/posts')
console.log(keys) // ["-N123", "-N124", "-N125"]

// เรียงจากมากไปน้อย
const keysReverse = await firebase.keys('/posts', true)
```

#### count - นับจำนวน

```typescript
const total = await firebase.count('/posts')
console.log(total) // 150
```

#### query - Query แบบละเอียด

```typescript
// ดึง 10 รายการแรก
const data = await firebase.query('/posts', {
  orderBy: '$key',
  limitToFirst: 10
})

// ดึงรายการที่มี score >= 100
const highScores = await firebase.query('/scores', {
  orderBy: 'score',
  startAt: 100
})

// ดึงรายการที่ status = 'active'
const activeUsers = await firebase.query('/users', {
  orderBy: 'status',
  equalTo: 'active'
})
```

### Pagination (เร็วที่สุด 🚀)

#### paginate - Cursor-based pagination

```typescript
// หน้าแรก (ล่าสุด)
const page1 = await firebase.paginate('/posts', 20, undefined, true)
console.log(page1.items)       // รายการ 20 รายการ
console.log(page1.nextCursor)  // cursor สำหรับหน้าถัดไป
console.log(page1.hasMore)     // มีหน้าถัดไปไหม

// หน้าถัดไป
const page2 = await firebase.paginate('/posts', 20, page1.nextCursor, true)

// หน้าถัดไปอีก
const page3 = await firebase.paginate('/posts', 20, page2.nextCursor, true)
```

#### paginateWithCount - Pagination พร้อมนับจำนวน

```typescript
const page = await firebase.paginateWithCount('/posts', 20, undefined, true)
console.log(page.items)    // รายการ 20 รายการ
console.log(page.total)    // จำนวนทั้งหมด
console.log(page.hasMore)  // มีหน้าถัดไปไหม
```

**💡 เคล็ดลับ:**
- ใช้ `paginateWithCount` เฉพาะหน้าแรก (เพื่อแสดง total)
- หน้าถัดไปใช้ `paginate` เพื่อความเร็ว

```typescript
// หน้าแรก - ขอ total
const page1 = await firebase.paginateWithCount('/posts', 20, undefined, true)
console.log(`Showing ${page1.items.length} of ${page1.total}`)

// หน้าถัดไป - ไม่ขอ total (เร็วกว่า)
const page2 = await firebase.paginate('/posts', 20, page1.nextCursor, true)
```

### Advanced Queries

#### top - ดึง N รายการสูงสุด

```typescript
// Top 10 คะแนนสูงสุด
const topScores = await firebase.top('/scores', 10, 'score')

// Top 5 โพสต์ล่าสุด
const recentPosts = await firebase.top('/posts', 5, '$key')
```

#### bottom - ดึง N รายการต่ำสุด

```typescript
// Bottom 10 คะแนนต่ำสุด
const lowScores = await firebase.bottom('/scores', 10, 'score')
```

#### findByValue - หาด้วยค่าที่แน่นอน

```typescript
// หา users ที่มี status = 'premium'
const premiumUsers = await firebase.findByValue('/users', 'status', 'premium')
```

#### range - ดึงข้อมูลในช่วง

```typescript
// ดึงโพสต์เดือนมกราคม 2024
const posts = await firebase.range(
  '/posts',
  'timestamp',
  1704067200000,  // 2024-01-01
  1706745599999   // 2024-01-31
)

// ดึงคะแนนระหว่าง 50-100
const midScores = await firebase.range('/scores', 'score', 50, 100)
```

### Transactions

#### transaction - อัพเดทแบบ atomic

```typescript
const result = await firebase.transaction<number>('/counter', (current) => {
  return (current || 0) + 1
})
```

#### increment - เพิ่ม/ลดค่าตัวเลข

```typescript
// เพิ่ม 1
await firebase.increment('/stats/views')

// เพิ่ม 10
await firebase.increment('/stats/points', 10)

// ลด 5
await firebase.increment('/stats/lives', -5)
```

### Batch Operations

```typescript
await firebase.batch([
  { type: 'set', path: '/users/1', data: { name: 'John' } },
  { type: 'update', path: '/users/2', data: { age: 31 } },
  { type: 'delete', path: '/users/3' }
])
```

## 🎯 Use Cases

### 1. Blog Posts with Pagination

```typescript
interface Post {
  title: string
  content: string
  author: string
  createdAt: number
}

// สร้างโพสต์ใหม่
const postId = await firebase.push<Post>('/posts', {
  title: 'Hello World',
  content: 'My first post',
  author: 'John',
  createdAt: Date.now()
})

// แสดงหน้าแรก (10 โพสต์ล่าสุด)
const page1 = await firebase.paginateWithCount<Post>('/posts', 10, undefined, true)
console.log(`Total posts: ${page1.total}`)
page1.items.forEach(item => {
  console.log(`${item.value.title} by ${item.value.author}`)
})

// หน้าถัดไป
const page2 = await firebase.paginate<Post>('/posts', 10, page1.nextCursor, true)
```

### 2. Leaderboard

```typescript
interface Score {
  username: string
  score: number
  timestamp: number
}

// บันทึกคะแนน
await firebase.set<Score>('/scores/user123', {
  username: 'John',
  score: 9500,
  timestamp: Date.now()
})

// Top 10 คะแนนสูงสุด
const leaderboard = await firebase.top<Score>('/scores', 10, 'score')
leaderboard.forEach((item, index) => {
  console.log(`#${index + 1}: ${item.value.username} - ${item.value.score}`)
})
```

### 3. Real-time Counter

```typescript
// เพิ่มจำนวนผู้เข้าชม
await firebase.increment('/stats/pageViews')

// เพิ่มจำนวนไลค์
await firebase.increment('/posts/post123/likes')

// ดูสถิติ
const views = await firebase.get<number>('/stats/pageViews')
console.log(`Total views: ${views}`)
```

### 4. User Activity Log

```typescript
interface Activity {
  userId: string
  action: string
  timestamp: number
}

// บันทึก activity
await firebase.push<Activity>('/activities', {
  userId: 'user123',
  action: 'login',
  timestamp: Date.now()
})

// ดึง activities ล่าสุด 50 รายการ
const recentActivities = await firebase.paginate<Activity>(
  '/activities',
  50,
  undefined,
  true
)
```

### 5. Filtered Search

```typescript
interface Product {
  name: string
  category: string
  price: number
  inStock: boolean
}

// หาสินค้าในหมวดหมู่ 'electronics'
const electronics = await firebase.findByValue<Product>(
  '/products',
  'category',
  'electronics'
)

// หาสินค้าราคา 1000-5000
const affordable = await firebase.range<Product>(
  '/products',
  'price',
  1000,
  5000
)

// หาสินค้าที่มีในสต็อก
const available = await firebase.findByValue<Product>(
  '/products',
  'inStock',
  true
)
```

## 🌐 Next.js API Route Example

```typescript
// app/api/posts/route.ts
import { NextResponse } from 'next/server'
import { firebase } from '@/lib/firebase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

  try {
    if (!cursor) {
      // หน้าแรก - ขอ total
      const result = await firebase.paginateWithCount(
        '/posts',
        pageSize,
        undefined,
        true
      )
      
      return NextResponse.json({
        items: result.items,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        total: result.total
      })
    } else {
      // หน้าถัดไป - ไม่ขอ total
      const result = await firebase.paginate(
        '/posts',
        pageSize,
        cursor,
        true
      )
      
      return NextResponse.json({
        items: result.items,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const postId = await firebase.push('/posts', {
      ...body,
      createdAt: Date.now()
    })
    
    return NextResponse.json({ id: postId }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Bad Request' },
      { status: 400 }
    )
  }
}
```

## 📱 React/Next.js Frontend Example

```typescript
'use client'

import { useState, useEffect } from 'react'

interface Post {
  key: string
  value: {
    title: string
    content: string
    createdAt: number
  }
}

export default function PostList() {
  const [posts, setPosts] = useState<Post[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const loadPosts = async (isFirstPage = false) => {
    if (loading || (!hasMore && !isFirstPage)) return
    
    setLoading(true)
    try {
      const url = isFirstPage
        ? '/api/posts?pageSize=20'
        : `/api/posts?pageSize=20&cursor=${cursor}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (isFirstPage) {
        setPosts(data.items)
        setTotal(data.total)
      } else {
        setPosts(prev => [...prev, ...data.items])
      }
      
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts(true)
  }, [])

  return (
    <div>
      {total && <h2>Total: {total} posts</h2>}
      
      <div>
        {posts.map(post => (
          <article key={post.key}>
            <h3>{post.value.title}</h3>
            <p>{post.value.content}</p>
            <time>{new Date(post.value.createdAt).toLocaleString()}</time>
          </article>
        ))}
      </div>
      
      {hasMore && (
        <button onClick={() => loadPosts()} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  )
}
```

## ⚡ Performance Tips

1. **ใช้ Pagination แทนการโหลดทั้งหมด**
   ```typescript
   // ❌ ช้า - โหลดทั้งหมด
   const allPosts = await firebase.get('/posts')
   
   // ✅ เร็ว - ใช้ pagination
   const page = await firebase.paginate('/posts', 20)
   ```

2. **ใช้ keys() แทน get() เมื่อต้องการแค่ keys**
   ```typescript
   // ❌ ช้า - โหลด values ทั้งหมด
   const data = await firebase.get('/posts')
   const keys = Object.keys(data)
   
   // ✅ เร็ว - โหลดแค่ keys
   const keys = await firebase.keys('/posts')
   ```

3. **Cache total count**
   ```typescript
   // หน้าแรก - นับ total
   const page1 = await firebase.paginateWithCount('/posts', 20)
   const total = page1.total
   
   // หน้าถัดไป - ใช้ total ที่ cache ไว้
   const page2 = await firebase.paginate('/posts', 20, page1.nextCursor)
   console.log(`Showing ${page2.items.length} of ${total}`)
   ```

4. **ใช้ Batch สำหรับ multiple operations**
   ```typescript
   // ❌ ช้า - ทำทีละอัน
   await firebase.set('/users/1', data1)
   await firebase.set('/users/2', data2)
   await firebase.set('/users/3', data3)
   
   // ✅ เร็ว - ทำพร้อมกัน
   await firebase.batch([
     { type: 'set', path: '/users/1', data: data1 },
     { type: 'set', path: '/users/2', data: data2 },
     { type: 'set', path: '/users/3', data: data3 }
   ])
   ```

## 🔒 Security Rules

อย่าลืมตั้ง Firebase Security Rules:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "posts": {
      ".indexOn": ["timestamp", "createdAt"]
    },
    "scores": {
      ".indexOn": ["score"]
    },
    "users": {
      ".indexOn": ["status", "email"]
    }
  }
}
```

## 📝 TypeScript Types

```typescript
// กำหนด type ให้ชัดเจน
interface User {
  name: string
  email: string
  age: number
  createdAt: number
}

// ใช้งานกับ type
const user = await firebase.get<User>('/users/123')
console.log(user?.name) // TypeScript รู้ว่ามี property name

const users = await firebase.top<User>('/users', 10, 'age')
users.forEach(item => {
  console.log(item.value.email) // Type-safe
})
```

## 🐛 Error Handling

```typescript
try {
  const data = await firebase.get('/posts/123')
  console.log(data)
} catch (error) {
  console.error('Firebase error:', error)
  // Error message จะบอกว่าเกิดอะไรขึ้น
}
```

## 📄 License

MIT

## 🤝 Contributing

Pull requests are welcome!

---

Made with ❤️ for Firebase developers