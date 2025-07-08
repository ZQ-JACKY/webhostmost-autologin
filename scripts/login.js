const puppeteer = require('puppeteer');
// const fetch = require('node-fetch'); // Node 18+ 可用全局 fetch

async function login(username, password) {
  console.log(`Attempting to login with username: ${username}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto('https://client.webhostmost.com/login', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await page.waitForSelector('#inputEmail', { timeout: 10000 });
    await page.type('#inputEmail', username);
    await page.type('#inputPassword', password);
    
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);
    
    const url = page.url();
    if (url.includes('clientarea.php')) {
      console.log(`✅ Successfully logged in as ${username}`);
      await sendTelegramMessage(`✅ 登录成功: ${username}`);
    } else {
      console.log(`❌ Failed to login as ${username}`);
      await sendTelegramMessage(`❌ 登录失败: ${username}`);
    }
    
    await page.screenshot({ path: `${username}-screenshot.png` });
    
  } catch (error) {
    console.error(`🚨 Error during login for ${username}:`, error);
    await sendTelegramMessage(`🚨 登录异常: ${username}\n${error}`);
  } finally {
    await browser.close();
  }
}

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('Telegram token or chat id not set');
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    if (!res.ok) {
      console.error('Failed to send Telegram message', await res.text());
    }
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

async function main() {
  try {
    // 从环境变量获取JSON格式凭据
    const credentialsJson = process.env.USERNAME_AND_PASSWORD;
    
    if (!credentialsJson) {
      throw new Error('No credentials provided. Please set USERNAME_AND_PASSWORD secret.');
    }
    
    // 解析JSON
    const accounts = JSON.parse(credentialsJson);
    console.log(`Found ${Object.keys(accounts).length} accounts to process`);
    
    // 遍历所有账户
    for (const [username, password] of Object.entries(accounts)) {
      try {
        console.log(`\n=== Processing account: ${username} ===`);
        await login(username, password);
        
        // 账户间延迟
        if (Object.keys(accounts).length > 1) {
          console.log('Waiting 5 seconds before next account...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error processing ${username}:`, error);
      }
    }
    
    console.log('\nAll accounts processed!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
