const puppeteer = require("puppeteer");

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

// const username = "312555014";
// const password = "3199931z";
// const nir = "187079202603071";

const PORT = process.env.PORT || 3000;
const TIMEOUT = 5000;

const AMELI_PRO_URL =
  "https://authps-espacepro.ameli.fr/oauth2/authorize?response_type=code&scope=openid%20profile%20infosps%20email&client_id=csm-cen-prod_ameliprotransverse-connexionadmin_1_amtrx_i1_csm-cen-prod%2Fameliprotransverse-connexionadmin_1%2Famtrx_i1&state=HiBkP8Gh9exOj6BdfmxsiQyTOrE&redirect_uri=https%3A%2F%2Fespacepro.ameli.fr%2Fredirect_uri&nonce=QkdprkTnaC38xCvFBhRPG1TBu3n-wqX355pg0jFQu5w";

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/ameli.html");
});

io.on("connection", async (client) => {
  console.log("a user connected");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(AMELI_PRO_URL);
  const urlCaptcha = await page.$eval(".captcha-image", (el) => el.src);
  console.log({ urlCaptcha });
  client.emit("urlCaptcha", urlCaptcha);

  client.on("getCaptcha", async ({ username, password, captcha, nir }) => {
    try {
      console.log({ username, password, captcha, nir });
      const patients = await getPatient(page, browser, { username, password, captcha, nir });
      console.log({ patients });
      client.emit("patients", patients);
    } catch (err) {
      console.error(err);
      client.emit("error", err);
    }
  });

  client.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(PORT, () => {
  console.log("listening on * " + PORT);
});

async function getPatient(page, browser, { username, password, captcha, nir }) {
  const navigationPromise = page.waitForNavigation();
  await page.type("#form-login input[name=user]", username);
  await page.type("#form-login input[name=password]", password);
  await page.type("#form-login input[name=captcha_user_code]", captcha);

  await page.click(" #form-login > .btn");
  await navigationPromise;

  await page
    .waitForSelector('input[name="c8_contextepatient_portletnirBeneficiaire"]', { timeout: TIMEOUT })
    .catch(() => {
      throw Error("nir input not found");
    });

  await page.type('input[name="c8_contextepatient_portletnirBeneficiaire"]', nir);
  await page.click("form[name=contextePatientForm] input[type=submit]");
  await navigationPromise;

  const beneficiaries = [];
  try {
    const singleBeneficiary = await getBeneficiaryInfo(page);
    console.log({ singleBeneficiary });
    beneficiaries.push(singleBeneficiary);
  } catch (error) {
    const selectCssSelector = "select[name=c8_contextepatient_portletidBeneficiaireSelectionne]";
    await page.waitForSelector(selectCssSelector, { timeout: TIMEOUT });

    const beneficiariesKeys = await page.$$eval(
      `${selectCssSelector} > option:not([value=''])`,
      // @ts-ignore
      (options) => options.map((el) => el.value)
    );

    // get all beneficiaries infos
    for (let i = 0; i < beneficiariesKeys.length; i++) {
      await page.click(selectCssSelector);

      await page.select(selectCssSelector, beneficiariesKeys[i]);
      await navigationPromise;
      const patient = await getBeneficiaryInfo(page);
      beneficiaries.push(patient);
    }
  } finally {
    browser.close();
  }

  return beneficiaries;
}

async function getBeneficiaryInfo(page) {
  await page.waitForSelector("form[name=contextePatientForm]");

  const [lastName, firstName, socialSecurityNumber, birthDate, rank, socialSecurityName, managementCentre] =
    await Promise.all([
      page.$eval("#info1", (el) => el.value),
      page.$eval("#info2", (el) => el.value),
      page.$eval("#info3", (el) => el.value),
      page.$eval("#info4", (el) => el.value),
      page.$eval("#info6", (el) => el.value),
      page.$eval("#info8", (el) => el.value),
      page.$eval("#info9", (el) => el.value),
    ]);

  return {
    lastName,
    firstName,
    socialSecurityNumber,
    birthDate,
    rank,
    socialSecurityName,
    managementCentre,
  };
}
