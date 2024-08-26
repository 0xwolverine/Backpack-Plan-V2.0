#!/bin/bash

# 安装所需的 npm 包
npm install
npm install @inquirer/prompts @inquirer/input @inquirer/number
npm install dotenv
npm install moment

# 创建 .env 文件
if [ ! -f ".env" ]; then
    touch .env
    echo ".env 文件已创建，请打开它并添加 Backpack API 密钥。"
else
    echo ".env 文件已存在。"
fi

# 将 .env 文件添加到 .gitignore 中（如果尚未添加）
if ! grep -q ".env" .gitignore; then
    echo ".env" >> .gitignore
    echo ".env 文件已添加到 .gitignore 中。"
else
    echo ".env 文件已在 .gitignore 中。"
fi

# 提示用户编辑 .env 文件
echo "请使用编辑器打开 .env 文件并添加 Backpack API 密钥。"
read -p "按回车键继续运行程序..." ignore

# 运行 Node.js 程序
sudo node ./index.js
