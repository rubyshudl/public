# Trip Canvas

可在线编辑的旅行计划网页，当前内置2026年美国东西海岸行程。

在线地址：<https://rubyshudl.github.io/public/trip-canvas/>

## 基础功能

- 按日期切换、增加、修改和删除旅行日
- 添加住宿、交通、玩乐、餐饮和备注，按时间自动排序
- 交通项目支持出发地、目的地和导航方式
- 单地点可在Google Maps查看，交通项目可直接打开Google Maps导航
- 自动组合一天内的地点，在Google Maps生成当日驾车路线
- 浏览器本地自动保存，并支持JSON备份和恢复
- 导出`.ics`日历文件，可导入Apple Calendar
- 每天可设置时区，日历按纽约或加州当地时间生成
- 桌面及手机响应式布局
- AI对话式行程编辑：先生成修改建议，确认后才写入

## 数据说明

当前版本是无后端的静态网页。编辑内容保存在浏览器的`localStorage`中，不会上传到GitHub。跨设备使用时，可通过顶部的“备份”和“导入”迁移数据。

Google Maps功能使用官方Maps URL，无需API Key。

## AI服务

GitHub Pages不能安全保存OpenAI API Key，因此AI功能使用独立的Cloudflare Worker代理。部署说明见[`../worker/README.md`](../worker/README.md)。
