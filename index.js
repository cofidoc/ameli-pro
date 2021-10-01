const puppeteer = require("puppeteer");
const { getPatient } = require("./getPatient");

const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);

// https://infi-mobile.ew.r.appspot.com/?username=312555014&password=3199931z
// const username = "312555014";
// const password = "3199931z";
// const nir = "187079202603071";

const PORT = process.env.PORT || 3000;
const AMELI_PRO_URL = "https://authps-espacepro.ameli.fr/";

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/ameli.html");
});

io.on("connection", async (client) => {
  console.log("a user connected");

  const browser = await puppeteer.launch({
    headless: true,
    timeout: 90000,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
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
