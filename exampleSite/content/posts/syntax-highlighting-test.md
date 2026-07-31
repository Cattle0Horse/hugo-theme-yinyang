---
title: "语法高亮测试"
date: 2024-01-15
tags: ["test", "development"]
categories: ["tech"]
---

## Markdown

```markdown
## 二级标题
### 三级标题
正文
1. 有序列表1
2. 有序列表2

无序列表
- 苹果
- 香蕉
- 西瓜
```

## Python

```python
import json
from typing import Optional

class User:
    """A simple user model."""
    def __init__(self, name: str, age: int = 0) -> None:
        self.name = name
        self.age = age

    def greet(self) -> str:
        if self.age < 18:
            return f"Hi {self.name}!"
        return f"Hello {self.name}!"

def load_users(path: str) -> list[User]:
    with open(path, "r") as f:
        data = json.load(f)
    return [User(**item) for item in data]

# 这是一行注释
users = load_users("users.json")
for u in users:
    print(u.greet())
```

## Go

```go
package main

import (
    "fmt"
    "os"
)

// Greeter greets someone.
type Greeter struct {
    Name string
    Age  int
}

func (g Greeter) Greet() string {
    if g.Age < 18 {
        return fmt.Sprintf("Hi %s!", g.Name)
    }
    return fmt.Sprintf("Hello %s!", g.Name)
}

func main() {
    g := Greeter{Name: "Alice", Age: 25}
    fmt.Println(g.Greet())

    if err := doWork(); err != nil {
        fmt.Fprintln(os.Stderr, "error:", err)
        os.Exit(1)
    }
}

func doWork() error {
    return nil
}
```

## JavaScript

```javascript
/** @type {import('./types').Config} */
const config = {
  port: 3000,
  debug: process.env.NODE_ENV !== "production",
}

async function fetchUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error("fetch failed:", err.message)
    return null
  }
}

export default config
```

## Bash

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$HOME/projects"
BUILD_DIR="/tmp/build"

echo "Building from $SRC_DIR ..."
cd "$SRC_DIR" || exit 1

for file in *.go; do
    go build -o "$BUILD_DIR/${file%.go}" "$file"
done

echo "Done. Built $(ls "$BUILD_DIR" | wc -l) binaries."
```

## HTML

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>示例页面</title>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <header>
    <h1>欢迎</h1>
    <nav>
      <a href="/">首页</a>
      <a href="/about">关于</a>
    </nav>
  </header>
  <main>
    <p class="intro">这是一个示例段落。lllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllll</p>
  </main>
  <footer>&copy; 2024</footer>
</body>
</html>
```

## SQL

```sql
SELECT u.name, COUNT(p.id) AS post_count
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
WHERE u.active = 1
  AND u.created_at > '2023-01-01'
GROUP BY u.name
HAVING COUNT(p.id) > 5
ORDER BY post_count DESC
LIMIT 10;
```

## YAML

```yaml
server:
  host: 0.0.0.0
  port: 8080

database:
  driver: postgres
  dsn: "host=localhost user=app password=secret dbname=app sslmode=disable"
  pool:
    max_open: 25
    max_idle: 5

logging:
  level: debug
  format: json
```

## Diff

```diff
 func (g Greeter) Greet() string {
-    return fmt.Sprintf("Hi %s!", g.Name)
+    if g.Age < 18 {
+        return fmt.Sprintf("Hi %s!", g.Name)
+    }
+    return fmt.Sprintf("Hello %s!", g.Name)
 }
```
