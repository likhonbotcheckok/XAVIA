import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import randomUseragent from 'random-useragent';
import fetch from 'node-fetch';

puppeteer.use(StealthPlugin());

const config = {
  name: "ck2",
  description: "Create Facebook accounts using hotmail999 temporary mail and auto fetch confirmation code",
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
    await page.type(selector, char, { delay: randomInt(100, 180) });
  }
}

async function humanMove(page) {
  await page.mouse.move(randomInt(0, 500), randomInt(0, 500));
  // Replace waitForTimeout with setTimeout wrapped in a Promise
  await new Promise(resolve => setTimeout(resolve, randomInt(300, 1000)));
}

async function createFacebookAccount(name, dob, email, password) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let uid = null;

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
    // Replace waitForTimeout with setTimeout wrapped in a Promise
    await new Promise(resolve => setTimeout(resolve, randomInt(5000, 9000)));

    // check if confirmation code page loaded (facebook usually shows code input here)
    const url = page.url();

    // Try get uid from cookie or url
    const cookies = await page.cookies();
    const c_user = cookies.find(c => c.name === 'c_user');
    if (c_user) uid = c_user.value;

    return { email, password, name, dob, uid, status: "Waiting for confirmation code" };
  } catch (err) {
    console.error('Error creating Facebook account:', err);
    return null;
  } finally {
    await browser.close();
  }
}

// Hotmail999 থেকে কোড নিয়ে আসার ফাংশন
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
  } catch (err) {
    console.error('Error fetching verification code:', err.message);
    return null;
  }
}

// ================== Command Handler ===================
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

      await message.reply(`🔄 Creating account ${i + 1} with email: ${email}`);

      const createResult = await createFacebookAccount(name, dob, email, password);

      if (!createResult) {
        await message.reply(`❌ Failed to create account ${i + 1}`);
        continue;
      }

      await message.reply(`⏳ Waiting for verification code for ${email}... (may take some seconds)`);

      // Polling hotmail999 API max 12 times (every 5 sec) to get code
      let code = null;
      for (let tryCount = 0; tryCount < 12; tryCount++) {
        code = await getVerificationCode(email);
        if (code) break;
        await new Promise(res => setTimeout(res, 5000)); // wait 5 seconds
      }

      if (!code) {
        await message.reply(`❌ Could not get verification code for ${email}`);
        results.push({ ...createResult, code: null });
      } else {
        await message.reply(`✅ Verification code for ${email}: ${code}`);
        results.push({ ...createResult, code });
      }
    }

    if (results.length === 0)
      return message.reply("❌ No accounts were created.");

    // Final summary (optional)
    let summary = `🎉 Created ${results.length} account(s):\n\n`;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      summary += `Account ${i + 1}:\n`;
      summary += `👤 Name: ${r.name}\n`;
      summary += `📧 Email: ${r.email}\n`;
      summary += `🔑 Password: ${r.password}\n`;
      summary += `🎂 DOB: ${r.dob.day}/${r.dob.month}/${r.dob.year}\n`;
      summary += `🆔 UID: ${r.uid}\n`;
      summary += `📨 Code: ${r.code ?? "Not received"}\n\n`;
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
