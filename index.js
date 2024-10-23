const fs = require('fs')
const path = require('path')
const readline = require('readline')
const cheerio = require('cheerio')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const askQuestion = query => {
  return new Promise(resolve => rl.question(query, resolve))
}

/* 獲取用戶列表 */
const getUserList = () => {
  const items = fs.readdirSync('../')
  const directories = items
    .filter(item => {
      const fullPath = path.join('../', item)
      return fs.statSync(fullPath).isDirectory() // 過濾出目錄
    })
    .filter(directoryName => directoryName !== '.wxexp' && directoryName !== 'WechatExporter-VoiceExporter') // 移除目錄

  const directoriesObj = directories.reduce((acc, dir, index) => {
    acc[index] = dir
    return acc
  }, {})

  return directoriesObj
}

/* 獲取當前用戶下的好友列表 */
const getChatList = selectedUser => {
  const items = fs.readdirSync(path.join('../', selectedUser))
  // 過濾出 HTML 文件，並移除 index.html
  const htmlFiles = items
    .filter(item => item.endsWith('.html') && item !== 'index.html') // 過濾 HTML 文件和 index.html
    .map(item => path.basename(item, '.html')) // 去除 .html 後綴

  const htmlFilesObj = htmlFiles.reduce((acc, dir, index) => {
    acc[index] = dir
    return acc
  }, {})

  return htmlFilesObj
}

/* 從html中提取語音 */
const getAudio = (htmlContent, selectedSubject) => {
  // 加載 HTML 內容
  let $ = cheerio.load(htmlContent)

  // 用於存儲提取出的 mp3 文件名
  const audioFiles = []

  // 選擇所有 class 包含 .msg 和 .media 的 div 標籤
  $('.msg.media').each((index, element) => {
    // 找到該 div 下的 .nt-box 標籤
    const ntBox = $(element).find('.nt-box')

    // 確認 .nt-box 中是否有 .dspname，並檢查內容是否與 selectedSubject 匹配
    const dspname = ntBox.find('.dspname').text()
    if (dspname === selectedSubject) {
      // 如果該 div 中存在 .voicebox，則進行處理
      const voicebox = $(element).find('.voicebox')
      if (voicebox.length > 0) {
        // 提取 .voicebox 的 audio 屬性中的 mp3 文件名
        const audioFile = voicebox.attr('audio')

        // 只提取文件名 (排除路徑，只保留文件名和格式)
        const fileName = audioFile.split('/').pop()

        // 將文件名 push 到 audioFiles 中
        audioFiles.push(fileName)
      }
    }
  })

  // 返回提取出的 mp3 文件名數組
  return audioFiles
}

/* 創建文件夾 */
// (如果文件夾存在，則直接清空文件夾的內容)
const mkdir = dir => {
  const dirPath = path.join(__dirname, dir)
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true })
  }
  fs.mkdirSync(dirPath, { recursive: true })
}

/* 刪除文件夾 */
const rmdir = dir => {
  const dirPath = path.join(__dirname, dir)
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}

;(async () => {
  try {
    /* 選擇微信帳號 */
    const userList = getUserList()
    let selectedUser
    while (!selectedUser) {
      console.clear()
      console.log(`你需要導出哪個微信號的語音？\n`)
      for (const [key, value] of Object.entries(userList)) {
        console.log(`${key}: ${value.padEnd(10)} `)
      }
      let choice = await askQuestion('\n請輸入序號: ')
      selectedUser = userList[choice]
      console.clear()
    }

    /* 選擇需要導出的對話 */
    const chatList = getChatList(selectedUser)
    let selectedChat
    while (!selectedChat) {
      console.log(`請選擇需要進行導出語音的對話:\n`)
      for (const [key, value] of Object.entries(chatList)) {
        console.log(`${key}: ${value.padEnd(10)} `)
      }
      let choice = await askQuestion('\n請輸入序號: ')
      selectedChat = chatList[choice]
      console.clear()
    }

    /* 選擇導出的是私聊還是群聊 */
    let selectedChatType
    while (!selectedChatType) {
      console.log(`「${selectedChat}」是「私聊」還是「群聊」?\n`)
      console.log(`0、私聊`)
      console.log(`1、群聊`)
      let choice = await askQuestion('\n請輸入序號: ')
      if (choice === '0') selectedChatType = '0'
      if (choice == '1') selectedChatType = '1'
      console.clear()
    }

    /* 選擇提取語音的對象 */
    let selectedSubject
    // 私聊的處理方式
    if (selectedChatType === '0') {
      while (!selectedSubject) {
        console.log('你需要提取誰的語音？')
        console.log(`0、${selectedUser}`)
        console.log(`1、${selectedChat}`)
        let choice = await askQuestion('\n請輸入序號: ')
        if (choice == 0) {
          selectedSubject = selectedUser
        }
        if (choice == 1) {
          selectedSubject = selectedChat
        }
        console.clear()
      }
    }
    // 群聊的處理方式
    if (selectedChatType === '1') {
      while (!selectedSubject) {
        console.log('你需要提取誰的語音？')
        let choice = await askQuestion('\n請輸入對方的微信暱稱（如果該人是你的好友，請填寫你為TA設置的備註名）: ')
        if (choice === selectedUser) {
          selectedSubject = selectedUser
        } else if (choice) {
          selectedSubject = choice
        }
        console.clear()
      }
    }

    /* 信息確認 */
    let choice
    while (true) {
      const tips = {
        '0': `即將提取「${selectedUser}」和「${selectedChat}」的對話中「${selectedSubject}」這部分的語音`,
        '1': `即將在群聊「${selectedChat}」中提取「${selectedSubject}」這部分的語音`
      }
      console.log(tips[selectedChatType])
      choice = await askQuestion('\n是否繼續操作？[y/Y:是][n/N:否]: ')
      if (choice === 'Y' || choice === 'y') {
        console.clear()
        break
      } else if (choice === 'N' || choice === 'n') {
        console.log('\n取消操作')
        process.exit(0)
      } else {
        console.clear()
      }
    }

    /* 創建臨時處理文件的文件夾 */
    const tempDir = `.temporary/${selectedUser}_${selectedChat}_${selectedChatType}_${selectedSubject}`
    mkdir(tempDir)

    /* 創建儲存提取後的語音文件的文件夾 */
    const distDir = `./dist/(${selectedChatType === '0' ? '私聊' : '群聊'}: ${selectedUser}-${selectedChat})_提取: ${selectedSubject}`
    mkdir(distDir)

    /* 從 .HTML 文件中進行讀取 */
    const htmlFilePath = path.join(__dirname, '../', selectedUser, selectedChat + '.html')
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8')
    const audioFiles = getAudio(htmlContent, selectedSubject)

    /* 從 [好友名]_files/Data 文件夾中提取 */
    const dataPath = path.join(__dirname, `../${selectedUser}/${selectedChat}_files/Data/`)
    const msgData = fs.readdirSync(dataPath, 'utf-8')
    // 對文件名進行從小到大排序
    msgData.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]) // 提取數字
      const numB = parseInt(b.match(/\d+/)[0]) // 提取數字
      return numA - numB // 按數字大小排序
    })
    // 移除js文件中的無用字段
    const removeRegular1 = /\(function\(.*\).*\{/gm
    const removeRegular2 = /for.*msgArray.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*\n.*/gm
    for (let mdi = 0; mdi < msgData.length; mdi++) {
      let msgDataContent = fs.readFileSync(dataPath + msgData[mdi], 'utf-8')
      msgDataContent = msgDataContent.replace(removeRegular1, '')
      msgDataContent = msgDataContent.replace(removeRegular2, '')
      msgDataContent += 'module.exports = msgArray;' // 使用 \n 确保是新的一行

      // 在臨時文件夾中創建js文件
      const filePath = path.join(__dirname, './' + tempDir + '/' + msgData[mdi])
      fs.writeFileSync(filePath, msgDataContent)

      // 引入文件
      const msgArray = require(filePath)
      msgArray.forEach((msg, msgIndex) => {
        console.clear()
        console.log(`正在從聊天記錄獲取語音文件名...： ${audioFiles.length}條`)
        audioFiles.push(...getAudio(msg, selectedSubject))
      })
    }
    // 刪除臨時文件夾
    rmdir(tempDir)

    /* 複製對應的語音文件到dist目錄 */
    audioFiles.forEach((audioName, audioIndex) => {
      const sourcePath = path.join(__dirname, `../${selectedUser}/${selectedChat}_files/${audioName}`)
      const targetPath = path.join(__dirname, distDir + '/' + audioName)
      fs.copyFileSync(sourcePath, targetPath)

      console.clear()
      console.log(`正在提取語音文件...： ${audioIndex + 1}條`)
    })

    console.clear()
    console.log(`已完成，語音文件儲存在：${path.join(__dirname, distDir)}/n`)

    process.exit(0)
  } catch (err) {
    console.error(err)
  }
})()
