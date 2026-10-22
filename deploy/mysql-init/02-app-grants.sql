-- 撤销镜像初始化时授予业务账号的该库权限，为收窄权限做准备。
REVOKE ALL PRIVILEGES ON `daily-expense-tracking`.* FROM 'expense_app'@'%';
-- 只授予业务账号日常增删改查权限，建表和升级由管理员执行。
GRANT SELECT, INSERT, UPDATE, DELETE ON `daily-expense-tracking`.* TO 'expense_app'@'%';