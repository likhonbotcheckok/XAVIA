import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import randomUseragent from 'random-useragent';
import fetch from 'node-fetch';

puppeteer.use(StealthPlugin());

const config = {
  name: "cfb",
  description: "Create Facebook accounts with random data, given password, and auto proxy rotation",
  usage: "cfb <number> - <password> - <gmailPrefix>",
  cooldown: 5,
  permissions: [0, 1, 2],
  credits: "RIN"
};

// === Get Fresh Proxy from API ===
// Example: Proxyscrape free HTTP proxies
async function getFreshProxy() {
  try {
    const res = await fetch("https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=2000&country=all&ssl=all&anonymity=all");
    const data = await res.text();
    const proxies = data.split("\n").filter(p => p.trim() !== "");
    if (proxies.length === 0) throw new Error("No proxies fetched");
    return proxies[Math.floor(Math.random() * proxies.length)];
  } catch (err) {
    console.error("❌ Proxy fetch error:", err.message);
    return null;
  }
}

// === Utility Functions ===
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate() {
  const year = randomInt(1985, 2003);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return { day, month, year };
}

function randomName() {
  const firstNames = ["John", "Alex", "Michael", "Chris", "David", "James", "Robert", "Daniel"];
  const lastNames = ["Smith", "Johnson", "Brown", "Williams", "Jones", "Miller", "Davis"];
  return `${firstNames[randomInt(0, firstNames.length - 1)]} ${lastNames[randomInt(0, lastNames.length - 1)]}`;
}

function randomEmail(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz1234567890';
  let extra = '';
  for (let i = 0; i < 5; i++) {
    extra += chars.charAt(randomInt(0, chars.length - 1));
  }
  return `${prefix}${extra}@gmail.com`;
}

async function humanType(page, selector, text) {
  for (let char of text) {
    await page.type(selector, char, { delay: randomInt(80, 200) });
  }
}

async function humanMove(page) {
  await page.mouse.move(randomInt(0, 500), randomInt(0, 500));
  await page.waitForTimeout(randomInt(300, 1000));
}

// === Facebook Account Creator ===
async function createFacebookAccount(name, dob, emailOrPhone, password, proxy) {
  const launchOptions = {
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${proxy}`]
  };

  const browser = await puppeteer.launch(launchOptions);
  let uid = null;

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());

    await page.goto('https://www.facebook.com/reg', { waitUntil: 'networkidle2', timeout: 60000 });

    await humanMove(page);
    await humanType(page, 'input[name="firstname"]', name.split(' ')[0]);
    await humanType(page, 'input[name="lastname"]', name.split(' ')[1]);
    await humanType(page, 'input[name="reg_email__"]', emailOrPhone);
    await humanType(page, 'input[name="reg_passwd__"]', password);

    await page.select('select[name="birthday_day"]', dob.day.toString());
    await page.select('select[name="birthday_month"]', dob.month.toString());
    await page.select('select[name="birthday_year"]', dob.year.toString());

    const genderSelector = ['input[value="1"]', 'input[value="2"]'][Math.floor(Math.random() * 2)];
    await page.click(genderSelector);
    await humanMove(page);

    await page.click('button[name="websubmit"]');
    await page.waitForTimeout(randomInt(5000, 8000));

    const url = page.url();
    const match = url.match(/profile\.php\?id=(\d+)/);
    if (match && match[1]) {
      uid = match[1];
    } else {
      const cookies = await page.cookies();
      const c_user = cookies.find(c => c.name === 'c_user');
      if (c_user) uid = c_user.value;
    }

    return {
      emailOrPhone,
      password,
      name,
      dob,
      uid: uid || '❓ Not available',
      status: "🕓 Waiting for confirmation code"
    };

  } catch (err) {
    console.error('Error creating account:', err);
    return null;
  } finally {
    await browser.close();
  }
}

// === Command Handler ===
export async function onCall({ message, args }) {
  try {
    if (args.length < 5) return message.reply("Usage: cfb <number> - <password> - <gmailPrefix>");

    const numberCount = parseInt(args[0]);
    if (isNaN(numberCount) || numberCount <= 0) return message.reply("Please enter a valid number.");

    if (args[1] !== '-') return message.reply("Use format: cfb <number> - <password> - <gmailPrefix>");

    const password = args[2];
    const prefix = args[4];

    let results = [];
    for (let i = 0; i < numberCount; i++) {
      const name = randomName();
      const dob = randomDate();
      const email = randomEmail(prefix);

      const proxy = await getFreshProxy();
      if (!proxy) {
        await message.reply(`❌ Could not fetch proxy for account ${i + 1}`);
        continue;
      }

      await message.reply(`🌐 Using proxy: ${proxy}`);

      const result = await createFacebookAccount(name, dob, email, password, proxy);
      if (result) {
        results.push(result);
        await message.reply(
          `✅ Account ${i + 1} created:\n` +
          `👤 Name: ${result.name}\n` +
          `📧 Email: ${result.emailOrPhone}\n` +
          `🔑 Password: ${result.password}\n` +
          `🎂 DOB: ${result.dob.day}/${result.dob.month}/${result.dob.year}\n` +
          `🆔 UID: ${result.uid}\n` +
          `📨 Status: ${result.status}`
        );
      } else {
        await message.reply(`❌ Error creating account ${i + 1}`);
      }
    }

    if (!results.length) return message.reply("❌ No accounts were created.");

  } catch (e) {
    await message.reply("❌ Error: " + e.message);
  }
}

export default {
  config,
  onCall
};
