import puppeteer from 'puppeteer';

const config = {
  name: "fbc2",
  description: "Create Facebook accounts with random phone number and given password",
  usage: "cfb <number> - <password>",
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
  const first = firstNames[randomInt(0, firstNames.length - 1)];
  const last = lastNames[randomInt(0, lastNames.length - 1)];
  return `${first} ${last}`;
}

// নতুন Random Bangladesh Number জেনারেটর
function randomPhone() {
  const prefix = "01";
  const secondDigit = randomInt(3, 9); // 013 - 019 range
  let number = prefix + secondDigit;
  for (let i = 0; i < 8; i++) {
    number += randomInt(0, 9);
  }
  return number;
}

async function createFacebookAccount(name, dob, phone, password) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
    defaultViewport: null
  });

  try {
    const page = await browser.newPage();

    await page.goto('https://www.facebook.com/reg', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.type('input[name="firstname"]', name.split(' ')[0], { delay: 50 });
    await page.type('input[name="lastname"]', name.split(' ')[1], { delay: 50 });
    await page.type('input[name="reg_email__"]', phone, { delay: 50 });
    await page.type('input[name="reg_passwd__"]', password, { delay: 50 });

    await page.select('select[name="birthday_day"]', dob.day.toString());
    await page.select('select[name="birthday_month"]', dob.month.toString());
    await page.select('select[name="birthday_year"]', dob.year.toString());

    const genderSelector = ['input[value="1"]', 'input[value="2"]'][Math.floor(Math.random() * 2)];
    await page.click(genderSelector);

    await page.click('button[name="websubmit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

    return {
      phone,
      password,
      name,
      dob,
      status: "Waiting for confirmation code"
    };

  } catch (err) {
    console.error('Error creating account:', err);
    return null;
  } finally {
    await browser.close();
  }
}

export async function onCall({ message, args }) {
  try {
    if (args.length < 3) return message.reply("Usage: cfb <number> - <password>");

    const numberCount = parseInt(args[0]);
    if (isNaN(numberCount) || numberCount <= 0) return message.reply("Please enter a valid number of accounts to create.");

    if (args[1] !== '-') return message.reply("Use this format: cfb <number> - <password>");

    const password = args.slice(2).join(' ');
    if (!password) return message.reply("Please provide a password.");

    let results = [];
    for (let i = 0; i < numberCount; i++) {
      const name = randomName();
      const dob = randomDate();
      const phone = randomPhone();

      const result = await createFacebookAccount(name, dob, phone, password);
      if (result) results.push(result);
      else await message.reply(`❌ Error creating account ${i + 1}`);
    }

    if (!results.length) return message.reply("❌ No accounts were created.");

    let replyText = `✅ Created ${results.length} accounts:\n\n`;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      replyText +=
        `Account ${i + 1}:\n` +
        `Phone: ${r.phone}\n` +
        `Password: ${r.password}\n` +
        `Name: ${r.name}\n` +
        `DOB: ${r.dob.day}/${r.dob.month}/${r.dob.year}\n` +
        `Status: ${r.status}\n\n`;
    }

    await message.reply(replyText);

  } catch (e) {
    await message.reply("❌ Error: " + e.message);
  }
}

export default {
  config,
  onCall
};
