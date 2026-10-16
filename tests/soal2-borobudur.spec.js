const { test, expect: baseExpect } = require('@playwright/test');

const BASE = 'https://borobudurmarathon.com';
const PORTAL = 'https://my.borobudurmarathon.com/';

// Pengaturan agar tidak timeout

// Waktu tunggu pengecekan (expect)
const expect = baseExpect.configure({ timeout: 15000 });

// Pengulangan test yang gagal sebanyak 1 kali
test.describe.configure({ retries: 1 });

test.use({
  navigationTimeout: 45000,
  actionTimeout: 15000,
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure',
});

const DOMAIN_DIIZINKAN = /(^|\.)borobudurmarathon\.com$|(^|\.)heartwork\.co\.id$|^use\.fontawesome\.com$/;

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90000);
  if (testInfo.title.startsWith('TC-Web-27')) return;
  await page.route('**/*', (route) => {
    const req = route.request();
    const host = new URL(req.url()).hostname;
    const berat = ['image', 'media', 'font'].includes(req.resourceType());
    const luar = !DOMAIN_DIIZINKAN.test(host);
    return berat || luar ? route.abort() : route.continue();
  });
});

// Fungsi bantuan

async function buka(page, alamat) {
  const url = alamat.startsWith('http') ? alamat : BASE + alamat;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
  return response;
}

// Menu utama di bagian atas halaman
function menuUtama(page, nama) {
  return page.locator('#menu-english > li > a', { hasText: nama }).first();
}

// Link di dalam menu navigasi, dicari berdasarkan teksnya
function linkMenu(page, nama) {
  return page.locator('nav').getByRole('link', { name: nama, exact: true }).first();
}

// Mengarahkan kursor ke menu sampai submenu-nya muncul (diulang kalau belum muncul)
async function hoverSampaiMuncul(page, menu, submenu) {
  await expect(async () => {
    await menuUtama(page, menu).hover();
    await baseExpect(linkMenu(page, submenu)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
}

// Data
const MENU_UTAMA = ['Home', 'The Race', 'Program', 'Media', 'Contact', 'Apps', 'Merchandise'];

const SUBMENU = {
  'The Race': ['Race Category', 'Rules & Regulations', 'Prizes', 'FAQ', 'Race Results'],
  'Program': ['Bank Jateng Friendship Run', 'Bank Jateng Young Talent'],
  'Media': ['Gallery', 'Race Guide'],
  'Contact': ['Sponsors', 'Contact Us'],
};

// [menu utama, submenu, alamat halaman yang diharapkan]
const HALAMAN = [
  ['The Race', 'Race Category', '/bank-jateng-borobudur-marathon-2026/'],
  ['The Race', 'Rules & Regulations', '/rules-regulations/'],
  ['The Race', 'Prizes', '/prizes-2026/'],
  ['The Race', 'FAQ', '/faq/'],
  ['The Race', 'Race Results', '/race-results/'],
  ['Program', 'Bank Jateng Friendship Run', '/friendship-run-program/'],
  ['Program', 'Bank Jateng Young Talent', '/young-talent-2026/'],
  ['Media', 'Gallery', '/gallery/'],
  ['Media', 'Race Guide', '/race-guide/'],
  ['Contact', 'Sponsors', '/sponsors/'],
  ['Contact', 'Contact Us', '/contact/'],
];

// HOMEPAGE & NAVIGASI
test.describe('Homepage & navigasi', () => {
  test('TC-Web-01 homepage terbuka dengan judul event 2026', async ({ page }) => {
    const response = await buka(page, '/');
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(/Borobudur Marathon 2026/);
  });

  test('TC-Web-02 klik logo kembali ke homepage', async ({ page }) => {
    await buka(page, '/faq/');
    await page.locator('.logo-module a').first().click();
    await page.waitForURL(BASE + '/', { waitUntil: 'domcontentloaded' });
  });

  test('TC-Web-03 semua menu utama dan pilihan bahasa tampil', async ({ page }) => {
    await buka(page, '/');
    for (const nama of MENU_UTAMA) {
      await expect(menuUtama(page, nama), `menu ${nama}`).toBeVisible();
    }
    await expect(page.locator('a[hreflang="en-US"]').first()).toBeVisible();
    await expect(page.locator('a[hreflang="id-ID"]').first()).toBeVisible();
  });

  const TES_DROPDOWN = [
    ['TC-Web-04', 'The Race'],
    ['TC-Web-05', 'Program'],
    ['TC-Web-06', 'Media'],
    ['TC-Web-07', 'Contact'],
  ];

  for (const [id, menu] of TES_DROPDOWN) {
    test(`${id} hover menu ${menu} menampilkan submenu`, async ({ page }) => {
      await buka(page, '/');
      await hoverSampaiMuncul(page, menu, SUBMENU[menu][0]);
      for (const sub of SUBMENU[menu]) {
        await expect(linkMenu(page, sub), `submenu ${sub}`).toBeVisible();
      }
    });
  }

  for (const [menu, sub, alamat] of HALAMAN) {
    test(`TC-Web-08 ${menu} > ${sub} membuka halaman yang benar`, async ({ page }) => {
      await buka(page, '/');
      await hoverSampaiMuncul(page, menu, sub);
      const href = await linkMenu(page, sub).getAttribute('href');
      expect(href).toContain(alamat);
      const response = await buka(page, new URL(href, BASE).href);
      expect(response.status()).toBeLessThan(400);
      await expect(page).not.toHaveTitle(/Page not found/);
    });
  }

  test('TC-Web-08 menu Apps dan Merchandise membuka halaman yang benar', async ({ page }) => {
    await buka(page, '/');
    await menuUtama(page, 'Apps').click();
    await page.waitForURL(/\/apps\/$/, { waitUntil: 'domcontentloaded' });
    await menuUtama(page, 'Merchandise').click();
    await page.waitForURL(/\/official-merchandise\/$/, { waitUntil: 'domcontentloaded' });
  });
});

// BAHASA
test.describe('Bahasa', () => {
  test('TC-Web-09 ganti bahasa ke Bahasa Indonesia', async ({ page }) => {
    await buka(page, '/');
    await page.locator('a[hreflang="id-ID"]').first().click();
    await page.waitForURL(BASE + '/id/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'id-ID');
  });

  test('TC-Web-10 kembali ke bahasa English', async ({ page }) => {
    await buka(page, '/id/');
    await page.locator('a[hreflang="en-US"]').first().click();
    await page.waitForURL(BASE + '/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('TC-Web-11 menu Young Talent di versi English membuka halaman English @bug BUG-10', async ({ page }) => {
    await buka(page, '/');
    const href = await page.locator('nav a', { hasText: 'Bank Jateng Young Talent' }).first().getAttribute('href');
    expect(href, 'link seharusnya tidak mengarah ke versi Indonesia (/id/)').not.toContain('/id/');
  });
});

// HALAMAN KONTEN
test.describe('Halaman konten', () => {
  test('TC-Web-12 Race Category menampilkan tanggal lomba dan 3 kategori', async ({ page }) => {
    await buka(page, '/bank-jateng-borobudur-marathon-2026/');
    const isi = page.locator('.main-container');
    await expect(isi).toContainText('November 15th 2026');
    await expect(isi).toContainText('42.195');
    await expect(isi).toContainText('21.097');
    await expect(isi).toContainText('10 kilometer');
    await expect(isi).toContainText('IDR');
  });

  test('TC-Web-13 tombol di kartu kategori punya teks dan link @bug BUG-01', async ({ page }) => {
    await buka(page, '/bank-jateng-borobudur-marathon-2026/');
    const tombol = page.locator('.main-container a.btn');
    const jumlah = await tombol.count();
    expect(jumlah).toBeGreaterThan(0);
    for (let i = 0; i < jumlah; i++) {
      expect.soft((await tombol.nth(i).innerText()).trim(), `teks tombol ke-${i + 1}`).not.toBe('');
      expect.soft(await tombol.nth(i).getAttribute('href'), `link tombol ke-${i + 1}`).not.toBe('');
    }
  });

  test('TC-Web-14 Rules & Regulations 2026 tampil tanpa salah ketik @bug BUG-02', async ({ page }) => {
    await buka(page, '/rules-regulations/');
    const href = await page.locator('a[href*="rules-regulations-borobudur-marathon"]').first().getAttribute('href');
    const response = await buka(page, new URL(href, BASE).href);
    expect(response.status()).toBe(200);
    const isi = page.locator('.main-container');
    await expect(isi).toContainText('Borobudur Marathon 2026');
    // cari kata yang ditulis dua kali berturut-turut, contoh: "to to"
    const teks = await isi.innerText();
    const kataDobel = teks.match(/\b([A-Za-z]{2,})[ \t]+\1\b/gi) || [];
    expect(kataDobel, 'kata yang ditulis dobel').toEqual([]);
  });

  test('TC-Web-15 FAQ Borobudur Marathon 2026 tampil', async ({ page }) => {
    await buka(page, '/faq/');
    const href = await page.locator('a[href*="faq-borobudur-marathon"]').first().getAttribute('href');
    const response = await buka(page, new URL(href, BASE).href);
    expect(response.status()).toBe(200);
    await expect(page.locator('.main-container')).toContainText('Borobudur Marathon 2026');
  });

  test('TC-Web-16 Race Results punya link hasil lomba 2017 sampai 2025', async ({ page }) => {
    await buka(page, '/race-results/');
    for (const tahun of ['2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017']) {
      const link = page.locator('.main-container a', { hasText: tahun }).first();
      await expect(link, `link tahun ${tahun}`).toBeVisible();
      await expect(link).toHaveAttribute('href', /^https:\/\//);
    }
  });

  test('TC-Web-17 setiap Race Guide membuka file PDF @bug BUG-03', async ({ page }) => {
    await buka(page, '/race-guide/');
    const links = page.locator('.main-container a', { hasText: 'Bank Jateng' });
    const jumlah = await links.count();
    expect(jumlah).toBeGreaterThan(0);
    for (let i = 0; i < jumlah; i++) {
      const nama = (await links.nth(i).innerText()).trim();
      expect.soft(await links.nth(i).getAttribute('href'), `race guide "${nama}"`).toMatch(/\.pdf$/);
    }
  });

  test('TC-Web-18 Apps punya link App Store dan Google Play', async ({ page }) => {
    await buka(page, '/apps/');
    await expect(page.locator('a[href*="apps.apple.com"]').first()).toBeVisible();
    await expect(page.locator('a[href*="play.google.com"]').first()).toBeVisible();
  });

  test('TC-Web-19 email di Contact Us membuka aplikasi email', async ({ page }) => {
    await buka(page, '/contact/');
    await expect(page.locator('.main-container a[href="mailto:info@borobudurmarathon.com"]').first()).toBeVisible();
  });
});

// FOOTER, SPONSOR & TEKNIS (TC-Web-20 s/d TC-Web-27, TC-Web-30)
test.describe('Footer, sponsor & teknis', () => {
  test('TC-Web-20 footer punya link 4 sosial media', async ({ page }) => {
    await buka(page, '/');
    const footer = page.locator('footer');
    await expect(footer.locator('a[href*="facebook.com"]')).toHaveCount(1);
    await expect(footer.locator('a[href*="twitter.com"], a[href*="x.com"]')).toHaveCount(1);
    await expect(footer.locator('a[href*="instagram.com"]')).toHaveCount(1);
    await expect(footer.locator('a[href*="youtube.com"]')).toHaveCount(1);
  });

  test('TC-Web-21 email di footer membuka aplikasi email @bug BUG-04', async ({ page }) => {
    await buka(page, '/');
    const email = page.locator('footer a', { hasText: 'info@borobudurmarathon.com' });
    await expect(email).toHaveAttribute('href', 'mailto:info@borobudurmarathon.com');
  });

  test('TC-Web-22 logo sponsor yang bisa diklik membuka situs sponsor @bug BUG-05', async ({ page }) => {
    await buka(page, '/');
    const logoTanpaTujuan = page.locator('a[href="#"]:has(img)');
    await expect(logoTanpaTujuan, 'jumlah logo dengan link "#"').toHaveCount(0);
  });

  test('TC-Web-23 deskripsi website memakai tahun 2026 @bug BUG-06', async ({ page }) => {
    await buka(page, '/');
    const deskripsi = await page.locator('meta[name="description"]').getAttribute('content');
    const namaSitus = await page.locator('meta[property="og:site_name"]').getAttribute('content');
    expect.soft(deskripsi, 'meta description').toContain('2026');
    expect.soft(namaSitus, 'og:site_name').toContain('2026');
  });

  test('TC-Web-24 alamat yang tidak ada menampilkan halaman 404', async ({ page }) => {
    const response = await buka(page, '/halaman-tidak-ada/');
    expect(response.status()).toBe(404);
    await expect(page).toHaveTitle(/Page not found/);
  });

  test('TC-Web-25 http otomatis diarahkan ke https', async ({ page }) => {
    await buka(page, 'http://borobudurmarathon.com/');
    expect(page.url()).toMatch(/^https:\/\//);
  });

  test('TC-Web-26 tombol Back to Top membawa ke atas halaman', async ({ page }) => {
    await buka(page, '/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator('a.top-link').first().click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10000 }).toBeLessThan(50);
  });

  test('TC-Web-27 tidak ada file yang gagal dimuat di homepage @bug BUG-07', async ({ page }) => {
    const gagal = [];
    page.on('response', (res) => {
      if (res.status() >= 400 && res.url().startsWith(BASE)) gagal.push(res.status() + ' ' + res.url());
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000); // beri waktu semua file selesai diminta
    expect(gagal, 'file yang gagal dimuat').toEqual([]);
  });

  test('TC-Web-30 tombol menuju portal peserta terlihat di homepage @bug BUG-08', async ({ page }) => {
    await buka(page, '/');
    await expect(page.locator('a[href^="https://my.borobudurmarathon.com"]').first()).toBeVisible();
  });
});

// TAMPILAN HP
test.describe('Tampilan HP', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }); // ukuran iPhone SE

  test('TC-Web-28 menu di tampilan HP bisa dibuka', async ({ page }) => {
    await buka(page, '/');
    const tombolMenu = page.locator('.nav-mobile-toggle');
    await expect(tombolMenu).toBeVisible();
    await tombolMenu.click();
    await expect(menuUtama(page, 'Merchandise')).toBeVisible();
  });

  test('TC-Web-29 tidak ada scroll ke samping di HP', async ({ page }) => {
    await buka(page, '/');
    const lebihLebar = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(lebihLebar).toBeLessThanOrEqual(0);
  });
});

// PORTAL PESERTA
test.describe('Portal peserta', () => {
  const TOMBOL_MASUK = 'button[type="submit"], button:has-text("Masuk"), button:has-text("Login"), button:has-text("Sign in")';

  test('TC-Web-31 login portal dengan field kosong @bug BUG-09', async ({ page }) => {
    await buka(page, PORTAL);
    const password = page.locator('input[type="password"]').first();
    await expect(password, 'form login seharusnya tampil').toBeVisible();
    await page.locator(TOMBOL_MASUK).first().click();
    await expect(page).toHaveURL(/signin/); // tetap di halaman login
    await expect(page.getByText(/wajib|required|harus diisi/i).first()).toBeVisible();
  });

  test('TC-Web-32 login portal dengan email dan password salah', async ({ page }) => {
    await buka(page, PORTAL);
    const password = page.locator('input[type="password"]').first();
    const formTampil = await password.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    // Kalau form login tidak muncul, test ini tidak bisa dijalankan (status Blocked)
    test.skip(!formTampil, 'Blocked: form login tidak tampil (lihat BUG-09)');
    await page.locator('input[type="email"], input[name*="email" i]').first().fill('test@example.com');
    await password.fill('Salah123');
    await page.locator(TOMBOL_MASUK).first().click();
    await expect(page).toHaveURL(/signin/); // tidak berhasil masuk
    await expect(page.getByText(/salah|gagal|invalid|incorrect|tidak ditemukan|not found/i).first()).toBeVisible();
  });
});