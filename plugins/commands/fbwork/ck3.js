import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import randomUseragent from 'random-useragent';
import fetch from 'node-fetch';

puppeteer.use(StealthPlugin());

const config = {
  name: "ck3",
  description: "Create Facebook accounts with hotmail999 temp mail and serial email prefix",
  usage: "cfb <number> - <password> - <mailPrefix>",
  cooldown: 5,
  permissions: [0, 1, 2],
  credits: "RIN"
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate() {
  const year = randomInt(1988, 2003);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return { day, month, year };
}

function randomName() {
  const firstNames = ["Mahi", "Tania", "Sumaiya", "Anika", "Mim", "Jannat", "Sadia", "Tasmia", "Raisa", "Nusrat", "Labiba", "Tahia"];
  const lastNames = ["Akter", "Khan", "Jahan", "Chowdhury", "Rahman", "Haque", "Sultana", "Begum"];
  return `${firstNames[randomInt(0, firstNames.length - 1)]} ${lastNames[randomInt(0, lastNames.length - 1)]}`;
}

function serialHotmail999Email(prefix, serial) {
  const serialStr = serial < 10 ? `0${serial}` : `${serial}`;
  return `${prefix}${serialStr}@hotmail999.com`;
}

async function humanType(page, selector, text) {
  for (const char of text) {
    if (Math.random() < 0.05) {
      await page.type(selector, 'x', { delay: randomInt(100, 180) });
      await page.keyboard.press('Backspace');
    }
    await page.type(selector, char, { delay: randomInt(100, 180) });
  }
}

async function humanMove(page) {
  await page.mouse.move(randomInt(0, 500), randomInt(0, 500));
  await page.mouse.move(randomInt(0, 800), randomInt(0, 800), { steps: randomInt(5, 15) });
  await page.evaluate(() => window.scrollBy(0, Math.random() * 200));
  await new Promise(resolve => setTimeout(resolve, randomInt(500, 1500)));
}

async function createFacebookAccount(name, dob, email, password) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let uid = null;

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom() || "Mozilla/5.0");

    await page.setViewport({ width: randomInt(360, 1920), height: randomInt(640, 1080) });
    await page.emulateTimezone(['Asia/Dhaka', 'Asia/Kolkata'][randomInt(0, 1)]);

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

    await new Promise(resolve => setTimeout(resolve, randomInt(5000, 9000)));

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

async function getVerificationCode(email) {
  try {
    const url = `https://hotmail999.com/api/get_mail.php?email=${encodeURIComponent(email)}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status && json.data && json.data.length > 0) {
      const latestMail = json.data[0];
      if (latestMail.code) return latestMail.code;
      if (latestMail.subject && /\d{5,8}/.test(latestMail.subject)) {
        return latestMail.subject.match(/\d{5,8}/)[0];
      }
      if (latestMail.text && /\d{5,8}/.test(latestMail.text)) {
        return latestMail.text.match(/\d{5,8}/)[0];
      }
    }
    return null;
  } catch (e) {
    console.error('Error fetching verification code:', e.message);
    return null;
  }
}

export async function onCall({ message, args }) {
  if (args.length < 5)
    return message.reply("Usage: cfb <number> - <password> - <mailPrefix>");

  const numberCount = parseInt(args[0]);
  if (isNaN(numberCount) || numberCount <= 0)
    return message.reply("Please enter a valid number.");

  if (args[1] !== '-')
    return message.reply("Use format: cfb <number> - <password> - <mailPrefix>");

  const password = args[2];
  const prefix = args[4];
  let results = [];

  for (let i = 1; i <= numberCount; i++) {
    const name = randomName();
    const dob = randomDate();
    const email = serialHotmail999Email(prefix, i);

    await message.reply(`🔄 Creating account ${i} with email: ${email}`);

    const createResult = await createFacebookAccount(name, dob, email, password);
    if (!createResult) {
      await message.reply(`❌ Failed to create account ${i}`);
      continue;
    }

    await message.reply(`⏳ Waiting for verification code for ${email}...`);

    let code = null;
    for (let tryCount = 0; tryCount < 12; tryCount++) {
      code = await getVerificationCode(email);
      if (code) break;
      await new Promise(res => setTimeout(res, 5000));
    }

    results.push({ ...createResult, code: code || null });
    await message.reply(
      code
        ? `✅ Verification code for ${email}: ${code}`
        : `❌ Could not get verification code for ${email}`
    );
  }

  if (!results.length) return message.reply("❌ No accounts were created.");

  let summary = `🎉 Created ${results.length} account(s):\n\n`;
  results.forEach((r, i) => {
    summary += `Account ${i + 1}:\n`;
    summary += `👤 ${r.name}\n📧 ${r.email}\n🔑 ${r.password}\n🎂 ${r.dob.day}/${r.dob.month}/${r.dob.year}\n🆔 ${r.uid}\n📨 ${r.code ?? "Not received"}\n\n`;
  });

  await message.reply(summary);
}

export default { config, onCall };
