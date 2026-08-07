---
title: "数学公式示例"
date: 2026-08-07
tags: ["test", "math", "katex"]
categories: ["tech"]
draft: false
---

本篇文章演示主题的数学公式支持。公式由 Hugo 内置的 KaTeX 引擎在**构建期**服务端渲染，页面加载时首帧即为排版好的公式，无 JS 排版、无跳跃。

## 行内公式

行内公式使用单个 `$` 定界符，例如 $a^2 + b^2 = c^2$，与正文混排：当 $n \geq 2$ 时，$2^n$ 的增长速度远超多项式。也可以这样写：$\frac{1}{2} + \frac{1}{3} = \frac{5}{6}$。

## 块级公式

块级公式使用双 `$$` 定界符，独占一行并居中显示：

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

## 分数与根式

嵌套分数与根式：

$$\frac{1}{1 + \frac{1}{1 + \frac{1}{1 + x}}}$$

$$\sqrt{2} \approx 1.414 \qquad \sqrt[3]{27} = 3$$

## 求和与积分

$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$

$$\int_{-\infty}^{+\infty} e^{-x^2} \, dx = \sqrt{\pi}$$

## 极限与连乘

$$\lim_{x \to 0} \frac{\sin x}{x} = 1$$

$$\prod_{k=1}^{n} k = n!$$

## 矩阵

$$\begin{pmatrix} a & b \\ c & d \end{pmatrix}
\begin{pmatrix} x \\ y \end{pmatrix} =
\begin{pmatrix} ax + by \\ cx + dy \end{pmatrix}$$

## 分段函数

$$|x| =
\begin{cases}
x, & x \geq 0 \\
-x, & x \lt 0
\end{cases}$$

## 多行对齐

$$\begin{aligned}
f(x) &= (x + 1)^2 \\
&= x^2 + 2x + 1
\end{aligned}$$

## 希腊字母与运算符

$\alpha, \beta, \gamma, \delta, \epsilon, \theta, \lambda, \mu, \pi, \sigma, \phi, \omega$

$\in, \notin, \subset, \subseteq, \cup, \cap, \times, \div, \cdot, \le, \ge, \ne, \approx$

## 化学式

使用 mhchem 扩展的 `\ce` 命令：

$$\ce{2H2 + O2 ->[\text{点燃}] 2H2O}$$

$$\ce{CO2 + H2O <=> H2CO3}$$

## 错误兜底

非法或未支持的公式会渲染为红色内联标注（默认色 `#cc0000`），而不是阻断构建或出现脚本错误。例如下面的 `\notacommand`：

$$\int \notacommand{x} \, dx$$
