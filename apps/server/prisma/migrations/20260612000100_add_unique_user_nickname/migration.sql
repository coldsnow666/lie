-- 为注册昵称增加数据库唯一约束，避免并发注册绕过服务层查重。
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");
