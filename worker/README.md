# Trip Canvas AI Worker

AI聊天功能的安全服务端代理。它把OpenAI API Key保存在Cloudflare Worker机密中，公开网页永远不会读取或保存API Key。

## 需要的机密

- `OPENAI_API_KEY`：OpenAI Platform API Key
- `AI_ACCESS_CODE`：网页连接AI时输入的私人访问码

复制 `wrangler.toml.example` 为 `wrangler.toml`，设置两项机密后部署。部署完成后，在网页AI面板的设置中填写Worker地址和私人访问码。

允许来源默认为 `https://rubyshudl.github.io`；本机测试地址也被允许。
