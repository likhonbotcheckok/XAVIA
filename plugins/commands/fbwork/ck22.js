import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import randomUseragent from 'random-useragent';
import fetch from 'node-fetch';

puppeteer.use(StealthPlugin());

const config = {
  name: "ck22",
  description: "Create Facebook accounts using hotmail999 and auto confirm with code",
  usage: "cfb <number> - <password> - <mailPrefix>",
  cooldown: 5,
  permissions: [0, 1, 2],
  credits: "RIN"
};

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

function randomHotmail999Email(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz1234567890';
  let extra = '';
  for (let i = 0; i < 5; i++) {
    extra += chars.charAt(randomInt(0, chars.length - 1));
  }
  return `${prefix}${extra}@hotmail999.com`;
}

async function humanType(page, selector, text) {
  for (const char of text) {
    await page.type(selector, char, { delay: randomInt(80, 150) });
  }
}

async function humanMove(page) {
  await page.mouse.move(randomInt(0, 500), randomInt(0, 500));
  await new Promise(resolve => setTimeout(resolve, randomInt(300, 800)));
}

async function getVerificationCode(email) {
  try {
    const url = `https://hotmail999.com/api/get_mail.php?email=${encodeURIComponent(email)}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status && json.data && json.data.length > 0) {
      const latestMail = json.data[0];
      if (latestMail.code) {
        return latestMail.code;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function createAndConfirmFacebook(name, dob, email, password) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let uid = null;
  let cookiesData = null;

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());

    await page.goto('https://www.facebook.com/reg', { waitUntil: 'networkidle2', timeout: 60000 });

    await humanMove(page);
    await humanType(page, 'input[name="firstname"]', name.split(' ')[0]);
    await humanType(page, 'input[name="lastname"]', name.split(' ')[1]);
    await humanType(page, 'input[name="reg_email__"]', email);
    await humanType(page, 'input[name="reg_passwd__"]', password);

    await page.select('select[name="birthday_day"]', dob.day.toString());
    await page.select('select[name="birthday_month"]', dob.month.toString());
    await page.select('select[name="birthday_year"]', dob.year.toString());

    const genderSelector = ['input[value="1"]', 'input[value="2"]'][randomInt(0, 1)];
    await page.click(genderSelector);

    await humanMove(page);
    await page.click('button[name="websubmit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for email code
    let code = null;
    for (let tryCount = 0; tryCount < 12; tryCount++) {
      code = await getVerificationCode(email);
      if (code) break;
      await new Promise(res => setTimeout(res, 5000));
    }

    if (code) {
      // Type code into confirmation field
      await humanType(page, 'input[name="code"]', code);
      await page.click('button[type="submit"]'); // Continue button
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
    }

    // Get cookies and UID
    const cookies = await page.cookies();
    cookiesData = cookies;
    const c_user = cookies.find(c => c.name === 'c_user');
    if (c_user) uid = c_user.value;

    return { email, password, name, dob, uid, code, status: code ? "Confirmed" : "Pending", cookies: cookiesData };
  } catch (err) {
    return null;
  } finally {
    await browser.close();
  }
}

// Command
export async function onCall({ message, args }) {
  try {
    if (args.length < 5)
      return message.reply("Usage: cfb <number> - <password> - <mailPrefix>");

    const numberCount = parseInt(args[0]);
    if (isNaN(numberCount) || numberCount <= 0)
      return message.reply("Please enter a valid number.");

    if (args[1] !== '-') return message.reply("Use format: cfb <number> - <password> - <mailPrefix>");

    const password = args[2];
    const prefix = args[4];

    let results = [];

    for (let i = 0; i < numberCount; i++) {
      const name = randomName();
      const dob = randomDate();
      const email = randomHotmail999Email(prefix);

      await message.reply(`🔄 Creating & confirming account ${i + 1} with email: ${email}`);

      const result = await createAndConfirmFacebook(name, dob, email, password);
      if (result) {
        results.push(result);
        await message.reply(`✅ Account ${i + 1} created & ${result.status}: ${email}`);
      } else {
        await message.reply(`❌ Failed account ${i + 1}`);
      }
    }

    if (!results.length) return message.reply("❌ No accounts created.");

    let summary = `🎉 Created ${results.length} account(s):\n\n`;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      summary += `Account ${i + 1}:\n`;
      summary += `👤 Name: ${r.name}\n`;
      summary += `📧 Email: ${r.email}\n`;
      summary += `🔑 Password: ${r.password}\n`;
      summary += `🎂 DOB: ${r.dob.day}/${r.dob.month}/${r.dob.year}\n`;
      summary += `🆔 UID: ${r.uid ?? "N/A"}\n`;
      summary += `📨 Code: ${r.code ?? "Not received"}\n`;
      summary += `📌 Status: ${r.status}\n\n`;
    }

    await message.reply(summary);
  } catch (e) {
    await message.reply("❌ Error: " + e.message);
  }
}

export default {
  config,
  onCall
};
