# 部署一套 AOS

单节点 k3s，从零到能登录。**每条命令都在 macOS 15 / Apple Silicon 上实跑过**，输出即下方所记；
不同宿主的差异只在第 0 步。

需要：Docker、kubectl，以及一个单节点 k3s。本机没有集群时用 k3d（它在 Docker 里跑真正的
k3s，不是模拟）。

---

## 0. 一个集群

```bash
k3d cluster create aos --agents 0 -p "8080:80@loadbalancer" --wait
```

`8080:80@loadbalancer` 把宿主的 8080 接到集群 ingress 上，之后浏览器就从
`http://localhost:8080` 进。

已有 k3s 的机器跳过这步，把下文的 `localhost:8080` 换成你的 ingress 地址。

核对（`local-path` 是 k3s 自带的存储类，两个 PVC 都用它）：

```bash
kubectl get nodes && kubectl get storageclass
```

## 1. 构建镜像并送进集群

```bash
docker build -t tcrn-aos:dev .
```

构建不联网取依赖：全部来自 lockfile 与 `vendor/*.tgz`。

```bash
docker save tcrn-aos:dev -o /tmp/tcrn-aos-dev.tar
k3d image import /tmp/tcrn-aos-dev.tar -c aos
```

**先存成 tarball 再导入，不要图省事直接 `k3d image import tcrn-aos:dev`。** Docker Desktop
启用 containerd 镜像存储时后者会报 `content digest not found`，而镜像其实没进集群——
Pod 随后卡在 `ImagePullBackOff`，看起来像镜像名写错了。

## 2. 口令

口令由你生成，产品**从不带默认凭据**。

```bash
kubectl create namespace aos

PGPASS=$(openssl rand -hex 16)
ADMINPASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
echo "把这个管理员口令记下来：$ADMINPASS"

kubectl -n aos create secret generic aos-secrets \
  --from-literal=postgres-password="$PGPASS" \
  --from-literal=database-url="postgres://aos:${PGPASS}@aos-postgres:5432/aos" \
  --from-literal=bootstrap-admin-user=ryan \
  --from-literal=bootstrap-admin-password="$ADMINPASS"
```

不提供 `bootstrap-admin-password` 也可以：首次启动会生成一个并打印一次到 Pod 日志，
用 `kubectl -n aos logs deploy/aos-app` 取。**两种方式都要求首次登录后立刻改口令。**

## 3. 应用

```bash
kubectl apply -k deploy/k8s/overlays/single-node
kubectl -n aos rollout status deploy/aos-app --timeout=5m
```

应用启动时会等数据库就绪，再在通告锁下跑迁移。首次启动因此比后续慢一些，这是正常的。

## 4. 确认

```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/readyz
```

`/readyz` 会回 `schemaVersion`；它比对的是**这个镜像携带的 schema 版本与数据库已应用的版本**，
所以迁移没跑完的 Pod 不会被放进流量。

浏览器打开 `http://localhost:8080`，用上面的账号口令登录，改掉口令，建第一个项目。

---

## 几件不显然但会咬人的事

**Postgres 的卷挂在 `/var/lib/postgresql`，不是 `/var/lib/postgresql/data`。**
`postgres:18-alpine` 的 `PGDATA` 是 `/var/lib/postgresql/18/docker`，声明的卷是
`/var/lib/postgresql`，而 `/var/lib/postgresql/data` **在镜像里根本不存在**。按 18 之前
通行的写法挂到 `/data`，会得到一个正常启动、正常服务、**每次重启把整个数据库丢光且全程不报错**
的部署。这是本次部署里后果最严重的一处，清单里写了同样的注解。

**`replicas: 1` 且 `strategy: Recreate`，因此每次发布有几秒不可用。** 限制来自附件卷是
ReadWriteOnce，不是数据库——会话、幂等记录和其余状态都在 Postgres 里。要多副本，换 RWX 卷或
接对象存储适配器即可，不需要改 schema。

**存活探针只探进程，就绪探针才碰数据库。** 数据库抖一下不该让应用反复重启：应用没坏，坏的是
它的依赖，重启它什么也修不好。

**`AOS_ALLOWED_HOSTS` 默认为空，即不校验 Host 头。** 哪些主机名是合法的属于部署方的知识，
不该由应用替你猜。对外暴露时把它填上（逗号分隔），Host 头不在名单里的请求在进入路由前就被拒。

## 卸掉

```bash
kubectl delete -k deploy/k8s/overlays/single-node
kubectl delete namespace aos          # 连 PVC 一起删，数据不留
k3d cluster delete aos
```
