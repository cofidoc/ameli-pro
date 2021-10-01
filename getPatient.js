const TIMEOUT = 5000;

exports.getPatient = getPatient;

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
