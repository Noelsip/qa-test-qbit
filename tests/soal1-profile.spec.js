const { test, expect } = require('@playwright/test');
const path = require('path');

const URL = 'file://' + path.resolve(__dirname, '../apps/profile.html');

// Data valid
const DATA_VALID = {
    firstName: 'Noel',
    middleName: 'Eric',
    lastName: 'Sipayung',
    nickname: 'noel',
    gender: 'Male',
    birthDate: '22 November 2005',
};

const NAMA_51_KARAKTER = 'Benedictus Christopher Emanuel Wahyu Wijaya Pratama';
const NICKNAME_21_KARAKTER = 'NoelEricSipayungKeren';
const SCRIPT = '<script>alert(1)</script>';

// Isi form
async function isiForm(page, ubah = {}) {
    const data = { ...DATA_VALID, ...ubah };
    await page.fill('#firstName', data.firstName);
    await page.fill('#middleName', data.middleName);
    await page.fill('#lastName', data.lastName);
    await page.fill('#nickname', data.nickname);
    await page.check(data.gender === 'Female' ? '#female' : '#male');
    await page.fill('#birthDate', data.birthDate);
}

async function klikSave(page) {
    await page.click('#save');
}

// Memastikan data tidak tersimpan
async function dataTidakTersimpan(page) {
    await page.waitForTimeout(700);
    await expect(page.locator('#message')).toHaveText('');
    expect(await page.evaluate(() => window.saveCount)).toBe(0);
}

// memastikan data tersimpan
async function dataTersimpan(page) {
    await expect(page.locator('#message')).toHaveText('Profile Saved Successfully');
    expect(await page.evaluate(() => window.saveCount)).toBe(1);
}

// Tanggal besok 
function besok() {
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
        'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

const MERAH = 'rgb(255, 0, 0)';

test.beforeEach(async ({ page }) => {
    await page.goto(URL);
});

test('TC-UI-01 semua elemen tampil sesuai desain', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(page.getByText('Input your profile')).toBeVisible();
    for (const label of ['First Name', 'Middle Name', 'Last Name', 'Nickname', 'Gender', 'Birth Date']) {
        await expect(page.locator('label', { hasText: label }).first()).toBeVisible();
    }
    await expect(page.locator('label[for=middleName]')).toContainText('(Optional)');
    await expect(page.locator('label[for=lastName]')).toContainText('(Optional)');
    await expect(page.locator('#firstName')).toHaveAttribute('placeholder', 'e.g Joel');
    await expect(page.locator('#middleName')).toHaveAttribute('placeholder', 'e.g K');
    await expect(page.locator('#lastName')).toHaveAttribute('placeholder', 'e.g Osteen');
    await expect(page.locator('#nickname')).toHaveAttribute('placeholder', 'Nickname');
    await expect(page.locator('#birthDate')).toHaveAttribute('placeholder', 'DD MMM YYYY');
    await expect(page.locator('#save')).toHaveText('Save');
});

test('TC-UI-02 gender default Male', async ({ page }) => {
    await expect(page.locator('#male')).toBeChecked();
    await expect(page.locator('#female')).not.toBeChecked();
});

test('TC-UI-03 simpan dengan semua data valid', async ({ page }) => {
    await isiForm(page);
    await klikSave(page);
    await dataTersimpan(page);
    expect(await page.evaluate(() => window.savedData)).toEqual({
        firstName: 'Noel', middleName: 'Eric', lastName: 'Sipayung',
        nickname: 'noel', gender: 'Male', birthDate: '22 Nov 2005',
    });
});

test('TC-UI-04 simpan hanya field wajib', async ({ page }) => {
    await isiForm(page, { middleName: '', lastName: '' });
    await klikSave(page);
    await dataTersimpan(page);
});

test('TC-UI-05 First Name kosong', async ({ page }) => {
    await isiForm(page, { firstName: '' });
    await klikSave(page);
    await expect(page.locator('#firstName-error')).toHaveText('First Name is required');
    await expect(page.locator('#firstName')).toHaveCSS('border-color', MERAH);
    await dataTidakTersimpan(page);
});

test('TC-UI-06 Nickname kosong', async ({ page }) => {
    await isiForm(page, { nickname: '' });
    await klikSave(page);
    await expect(page.locator('#nickname-error')).toHaveText('Nickname is required');
    await expect(page.locator('#nickname')).toHaveCSS('border-color', MERAH);
    await dataTidakTersimpan(page);
});

test('TC-UI-07 Birth Date kosong', async ({ page }) => {
    await isiForm(page, { birthDate: '' });
    await klikSave(page);
    await expect(page.locator('#birthDate-error')).toHaveText('Birth Date is required');
    await expect(page.locator('#birthDate')).toHaveCSS('border-color', MERAH);
    await dataTidakTersimpan(page);
});

test('TC-UI-08 semua field kosong', async ({ page }) => {
    await klikSave(page);
    await expect(page.locator('#firstName-error')).toHaveText('First Name is required');
    await expect(page.locator('#nickname-error')).toHaveText('Nickname is required');
    await expect(page.locator('#birthDate-error')).toHaveText('Birth Date is required');
    await expect(page.locator('#middleName-error')).toHaveText('');
    await expect(page.locator('#lastName-error')).toHaveText('');
    await dataTidakTersimpan(page);
});

test('TC-UI-09 First Name hanya spasi', async ({ page }) => {
    await isiForm(page, { firstName: '     ' });
    await klikSave(page);
    await expect(page.locator('#firstName-error')).toHaveText('First Name is required');
    await dataTidakTersimpan(page);
});

test('TC-UI-10 First Name berisi angka', async ({ page }) => {
    await isiForm(page, { firstName: 'Noel123' });
    await klikSave(page);
    await expect(page.locator('#firstName-error')).toHaveText('First Name may only contain letters');
    await dataTidakTersimpan(page);
});

test('TC-UI-11 First Name berisi simbol', async ({ page }) => {
    await isiForm(page, { firstName: 'N@el#' });
    await klikSave(page);
    await expect(page.locator('#firstName-error')).toHaveText('First Name may only contain letters');
    await dataTidakTersimpan(page);
});

test('TC-UI-12 First Name dengan apostrof dan tanda hubung', async ({ page }) => {
    await isiForm(page, { firstName: "O'Niel-Smith" });
    await klikSave(page);
    await dataTersimpan(page);
});

test('TC-UI-13 First Name 51 karakter', async ({ page }) => {
    await isiForm(page, { firstName: NAMA_51_KARAKTER });
    await klikSave(page);
    await expect(page.locator('#firstName-error')).toHaveText('The First Name must contain a maximum of 50 characters.');
    await dataTidakTersimpan(page);
});

test('TC-UI-14 Middle Name 51 karakter', async ({ page }) => {
    await isiForm(page, { middleName: NAMA_51_KARAKTER });
    await klikSave(page);
    await expect(page.locator('#middleName-error')).toHaveText('The Middle Name must contain a maximum of 50 characters.');
    await dataTidakTersimpan(page);
});

test('TC-UI-15 Last Name 51 karakter', async ({ page }) => {
    await isiForm(page, { lastName: NAMA_51_KARAKTER });
    await klikSave(page);
    await expect(page.locator('#lastName-error')).toHaveText('The Last Name must contain a maximum of 50 characters.');
    await dataTidakTersimpan(page);
});

test('TC-UI-16 Nickname 21 karakter', async ({ page }) => {
    await isiForm(page, { nickname: NICKNAME_21_KARAKTER });
    await klikSave(page);
    await expect(page.locator('#nickname-error')).toHaveText('The Nickname must contain a maximum of 20 characters.');
    await dataTidakTersimpan(page);
});

test('TC-UI-17 Middle Name berisi angka', async ({ page }) => {
    await isiForm(page, { middleName: 'Eric32' });
    await klikSave(page);
    await expect(page.locator('#middleName-error')).toHaveText('Middle Name may only contain letters');
    await dataTidakTersimpan(page);
});

test('TC-UI-18 Last Name berisi angka', async ({ page }) => {
    await isiForm(page, { lastName: 'Sipayung32' });
    await klikSave(page);
    await expect(page.locator('#lastName-error')).toHaveText('Last Name may only contain letters');
    await dataTidakTersimpan(page);
});

// TC-UI-19 sampai TC-UI-22: script di setiap field teks
const TES_SCRIPT = [
    ['TC-UI-19', 'First Name', 'firstName', 'First Name may only contain letters'],
    ['TC-UI-20', 'Middle Name', 'middleName', 'Middle Name may only contain letters'],
    ['TC-UI-21', 'Last Name', 'lastName', 'Last Name may only contain letters'],
    ['TC-UI-22', 'Nickname', 'nickname', 'Nickname may only contain letters and numbers'],
];

for (const [id, namaField, field, pesanError] of TES_SCRIPT) {
    test(`${id} input script pada ${namaField}`, async ({ page }) => {
        let adaPopup = false;
        page.on('dialog', async (dialog) => { adaPopup = true; await dialog.dismiss(); });
        await isiForm(page, { [field]: SCRIPT });
        await klikSave(page);
        await expect(page.locator(`#${field}-error`)).toHaveText(pesanError);
        expect(adaPopup).toBe(false); // script tidak boleh dijalankan
        await dataTidakTersimpan(page);
    });
}

test('TC-UI-23 pilih Female', async ({ page }) => {
    await isiForm(page, { gender: 'Female' });
    await expect(page.locator('#female')).toBeChecked();
    await expect(page.locator('#male')).not.toBeChecked();
    await klikSave(page);
    await dataTersimpan(page);
    expect((await page.evaluate(() => window.savedData)).gender).toBe('Female');
});

test('TC-UI-24 nama bulan bahasa Indonesia diubah ke format DD MMM YYYY', async ({ page }) => {
    await isiForm(page, { gender: 'Female', birthDate: '22 Mei 2005' });
    await klikSave(page);
    await expect(page.locator('#birthDate')).toHaveValue('22 May 2005');
    await dataTersimpan(page);
});

test('TC-UI-25 tanggal lahir di masa depan', async ({ page }) => {
    await isiForm(page, { gender: 'Female', birthDate: besok() });
    await klikSave(page);
    await expect(page.locator('#birthDate-error')).toHaveText('Birth Date cannot be in the future');
    await dataTidakTersimpan(page);
});

test('TC-UI-26 klik Save 3 kali hanya tersimpan sekali', async ({ page }) => {
    await isiForm(page);
    await klikSave(page);
    await page.click('#save', { force: true }).catch(() => {});
    await page.click('#save', { force: true }).catch(() => {});
    await page.waitForTimeout(700);
    await dataTersimpan(page);
});

test('TC-UI-27 tombol Back saat ada isian memunculkan konfirmasi', async ({ page }) => {
    let pesan = '';
    page.on('dialog', async (dialog) => { pesan = dialog.message(); await dialog.dismiss(); });
    await page.fill('#firstName', 'Noel');
    await page.getByRole('button', { name: 'Back' }).click();
    expect(pesan).toBe('Discard changes?');
    await expect(page.locator('#firstName')).toHaveValue('Noel');
});