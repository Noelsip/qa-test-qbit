const { test, expect } = require('@playwright/test');
const path = require('path');

const URL = 'file://' + path.resolve(__dirname, '../apps/pos.html');

// Kombinasi barang yang sering dipakai
const BELANJA_100RB = ['nasi-goreng', 'roti-bakar', 'kopi-susu', 'kentang-goreng'];
const BELANJA_99RB = ['nasi-goreng', 'roti-bakar', 'mie-ayam', 'cokelat-batang'];

// Fungsi bantuan
async function tambahBarang(page, ...barang) {
    for (const id of barang) await page.click(`#tambah-${id}`);
}

async function applyDiskon(page) {
    await page.click('#btn-diskon');
}

async function prosesBayar(page, metode) {
    await page.check(`#metode-${metode}`);
    await page.click('#btn-bayar');
    await expect(page.locator('#panel-bayar')).toBeVisible();
}

async function bayarTunai(page, nominal) {
    await page.fill('#uang-tunai', String(nominal));
    await page.click('#btn-bayar-tunai');
}

async function selesaikanPenjualan(page) {
    await page.click('#btn-selesai');
    await expect(page.locator('#struk')).toBeVisible();
}

// Alur lengkap split Rp100.000 sampai struk muncul
async function transaksiSplitLunas(page) {
    await tambahBarang(page, ...BELANJA_100RB);
    await prosesBayar(page, 'split');
    await bayarTunai(page, 40000);
    await page.click('#btn-qris-berhasil');
    await selesaikanPenjualan(page);
}

test.beforeEach(async ({ page }) => {
    await page.goto(URL);
});

// SPLIT PAYMENT 40% TUNAI 60% QRIS
test.describe('3a. Split payment 40:60', () => {
    test('TC-SP-01 split dengan uang tunai pas', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await prosesBayar(page, 'split');
        await expect(page.locator('#tagihan')).toHaveText('Rp100.000');
        await expect(page.locator('#porsi-tunai')).toHaveText('Rp40.000');
        await expect(page.locator('#porsi-qris')).toHaveText('Rp60.000');

        await bayarTunai(page, 40000);
        await expect(page.locator('#kembalian')).toHaveText('Rp0');
        await expect(page.locator('#status')).toHaveText('Sebagian Dibayar');

        await page.click('#btn-qris-berhasil');
        await expect(page.locator('#status')).toHaveText('Lunas');

        await selesaikanPenjualan(page);
        const struk = page.locator('#struk');
        await expect(struk).toContainText('Total: Rp100.000');
        await expect(struk).toContainText('Tunai: Rp40.000');
        await expect(struk).toContainText('QRIS: Rp60.000');
        await expect(struk).toContainText('Status: LUNAS');
    });

    test('TC-SP-02 uang tunai lebih dari porsi 40%', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await prosesBayar(page, 'split');
        await bayarTunai(page, 50000);
        await expect(page.locator('#kembalian')).toHaveText('Rp10.000');
        await expect(page.locator('#nominal-qris')).toHaveText('Rp60.000'); // porsi QRIS tidak berkurang
        await page.click('#btn-qris-berhasil');
        await selesaikanPenjualan(page);
        await expect(page.locator('#struk')).toContainText('Kembalian: Rp10.000');
    });

    test('TC-SP-03 uang tunai kurang dari porsi 40%', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await prosesBayar(page, 'split');
        await bayarTunai(page, 39999);
        await expect(page.locator('#pesan-bayar')).toHaveText('Uang tunai kurang dari Rp40.000');
        await expect(page.locator('#status')).toHaveText('Belum Dibayar');
        await expect(page.locator('#tahap-qris')).toBeHidden();
        await expect(page.locator('#btn-selesai')).toBeDisabled();
    });

    test('TC-SP-04 total ganjil dibulatkan tanpa selisih', async ({ page }) => {
        await tambahBarang(page, 'cokelat-batang'); // Rp12.999
        await prosesBayar(page, 'split');
        await expect(page.locator('#porsi-tunai')).toHaveText('Rp5.200');
        await expect(page.locator('#porsi-qris')).toHaveText('Rp7.799'); // 5.200 + 7.799 = 12.999
    });

    test('TC-SP-05 QRIS gagal lalu dicoba lagi berhasil', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await prosesBayar(page, 'split');
        await bayarTunai(page, 40000);

        await page.click('#btn-qris-gagal');
        await expect(page.locator('#pesan-bayar')).toHaveText('Pembayaran QRIS gagal. Silakan coba lagi atau batalkan transaksi');
        await expect(page.locator('#status')).toHaveText('Sebagian Dibayar');
        await expect(page.locator('#btn-selesai')).toBeDisabled();

        await page.click('#btn-qris-berhasil');
        await expect(page.locator('#status')).toHaveText('Lunas');
        await expect(page.locator('#btn-selesai')).toBeEnabled();
    });

    test('TC-SP-06 batal setelah uang tunai dibayar', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await prosesBayar(page, 'split');
        await bayarTunai(page, 40000);
        await page.click('#btn-batal');
        await expect(page.locator('#status')).toHaveText('Dibatalkan');
        await expect(page.locator('#pesan-bayar')).toHaveText('Transaksi dibatalkan. Uang tunai Rp40.000 dikembalikan ke pelanggan');
        await expect(page.locator('#btn-selesai')).toBeDisabled();
    });

    test('TC-SP-07 split dihitung dari total setelah diskon', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await applyDiskon(page);
        await prosesBayar(page, 'split');
        await expect(page.locator('#tagihan')).toHaveText('Rp90.000');
        await expect(page.locator('#porsi-tunai')).toHaveText('Rp36.000');
        await expect(page.locator('#porsi-qris')).toHaveText('Rp54.000');
        await bayarTunai(page, 36000);
        await page.click('#btn-qris-berhasil');
        await selesaikanPenjualan(page);
        await expect(page.locator('#struk')).toContainText('Diskon: -Rp10.000');
    });

    test('TC-SP-08 tahap QRIS belum muncul sebelum tunai dibayar', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await prosesBayar(page, 'split');
        await expect(page.locator('#tahap-tunai')).toBeVisible();
        await expect(page.locator('#tahap-qris')).toBeHidden();
    });

    const INPUT_TIDAK_VALID = [
        ['TC-SP-09', 'kosong', ''],
        ['TC-SP-10', 'nol', '0'],
        ['TC-SP-11', 'negatif', '-5000'],
    ];

    for (const [id, nama, nilai] of INPUT_TIDAK_VALID) {
        test(`${id} input uang tunai ${nama} ditolak`, async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await prosesBayar(page, 'split');
        await bayarTunai(page, nilai);
        await expect(page.locator('#pesan-bayar')).toHaveText('Masukkan nominal uang tunai yang valid');
        await expect(page.locator('#status')).toHaveText('Belum Dibayar');
        });
    }

    test('TC-SP-12 Complete Sale diklik dua kali hanya tercatat sekali', async ({ page }) => {
        await transaksiSplitLunas(page);
        await page.click('#btn-selesai', { force: true }).catch(() => {});
        expect(await page.evaluate(() => window.jumlahPenjualan)).toBe(1);
    });

    test('TC-SP-13 keranjang terkunci setelah masuk pembayaran', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await prosesBayar(page, 'split');
        await expect(page.locator('#tambah-teh-manis')).toBeDisabled();
        await expect(page.locator('#hapus-nasi-goreng')).toBeDisabled();
        await expect(page.locator('#btn-diskon')).toBeDisabled();
        await expect(page.locator('#tagihan')).toHaveText('Rp100.000');
    });

    test('TC-SP-14 keranjang kosong tidak bisa diproses', async ({ page }) => {
        await expect(page.locator('#btn-bayar')).toBeDisabled();
    });

    test('TC-SP-15 cetak struk', async ({ page }) => {
        await transaksiSplitLunas(page);
        await page.click('#btn-cetak');
        await expect(page.locator('#pesan-struk')).toHaveText('Struk sedang dicetak');
    });

    test('TC-SP-16 kirim struk digital ke email valid', async ({ page }) => {
        await transaksiSplitLunas(page);
        await page.fill('#email-struk', 'budi@mail.com');
        await page.click('#btn-kirim-struk');
        await expect(page.locator('#pesan-struk')).toHaveText('Struk digital berhasil dikirim ke budi@mail.com');
    });

    test('TC-SP-17 kirim struk digital ke email tidak valid', async ({ page }) => {
        await transaksiSplitLunas(page);
        await page.fill('#email-struk', 'budi@mail');
        await page.click('#btn-kirim-struk');
        await expect(page.locator('#pesan-struk')).toHaveText('Format email tidak valid');
    });
});

// DISKON 10% UNTUK BELANJA MINIMAL RP100.000
test.describe('3b. Diskon minimal belanja Rp100.000', () => {
    test('TC-DS-01 subtotal Rp99.999 tidak dapat diskon', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_99RB);
        await expect(page.locator('#subtotal')).toHaveText('Rp99.999');
        await applyDiskon(page);
        await expect(page.locator('#pesan-diskon')).toHaveText('Minimum belanja Rp100.000 untuk mendapatkan diskon');
        await expect(page.locator('#diskon')).toHaveText('Rp0');
        await expect(page.locator('#total')).toHaveText('Rp99.999');
    });

    test('TC-DS-02 subtotal tepat Rp100.000 dapat diskon', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await applyDiskon(page);
        await expect(page.locator('#pesan-diskon')).toHaveText('Diskon 10% berhasil diterapkan');
        await expect(page.locator('#diskon')).toHaveText('-Rp10.000');
        await expect(page.locator('#total')).toHaveText('Rp90.000');
    });

    test('TC-DS-03 subtotal Rp112.999 diskon dibulatkan', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB, 'cokelat-batang');
        await expect(page.locator('#subtotal')).toHaveText('Rp112.999');
        await applyDiskon(page);
        await expect(page.locator('#diskon')).toHaveText('-Rp11.300');
        await expect(page.locator('#total')).toHaveText('Rp101.699');
    });

    test('TC-DS-04 satu barang dengan jumlah banyak', async ({ page }) => {
        await tambahBarang(page, ...Array(6).fill('kopi-susu')); // 6 x 18.000
        await expect(page.locator('#qty-kopi-susu')).toHaveText('6');
        await expect(page.locator('#subtotal')).toHaveText('Rp108.000');
        await applyDiskon(page);
        await expect(page.locator('#diskon')).toHaveText('-Rp10.800');
        await expect(page.locator('#total')).toHaveText('Rp97.200');
    });

    test('TC-DS-05 diskon ditolak lalu tambah barang dan coba lagi', async ({ page }) => {
        await tambahBarang(page, 'nasi-goreng', 'roti-bakar'); // Rp60.000
        await applyDiskon(page);
        await expect(page.locator('#pesan-diskon')).toHaveText('Minimum belanja Rp100.000 untuk mendapatkan diskon');
        await tambahBarang(page, 'kopi-susu', 'kentang-goreng'); // jadi Rp100.000
        await applyDiskon(page);
        await expect(page.locator('#pesan-diskon')).toHaveText('Diskon 10% berhasil diterapkan');
        await expect(page.locator('#total')).toHaveText('Rp90.000');
    });

    test('TC-DS-06 hapus barang setelah diskon sampai di bawah Rp100.000', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await applyDiskon(page);
        await page.click('#hapus-kopi-susu'); // jadi Rp82.000
        await expect(page.locator('#subtotal')).toHaveText('Rp82.000');
        await expect(page.locator('#diskon')).toHaveText('Rp0');
        await expect(page.locator('#total')).toHaveText('Rp82.000');
        await expect(page.locator('#pesan-diskon')).toHaveText('Diskon dibatalkan karena total belanja di bawah Rp100.000');
    });

    test('TC-DS-07 kurangi jumlah barang setelah diskon sampai di bawah Rp100.000', async ({ page }) => {
        await tambahBarang(page, 'nasi-goreng', 'nasi-goreng', 'nasi-goreng'); // Rp105.000
        await applyDiskon(page);
        await expect(page.locator('#total')).toHaveText('Rp94.500');
        await page.click('#kurangi-nasi-goreng'); // jadi Rp70.000
        await expect(page.locator('#diskon')).toHaveText('Rp0');
        await expect(page.locator('#total')).toHaveText('Rp70.000');
    });

    test('TC-DS-08 tambah barang setelah diskon dihitung ulang', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await applyDiskon(page);
        await tambahBarang(page, 'air-mineral'); // jadi Rp105.000
        await expect(page.locator('#diskon')).toHaveText('-Rp10.500');
        await expect(page.locator('#total')).toHaveText('Rp94.500');
    });

    test('TC-DS-09 Apply Discount diklik dua kali tidak dobel', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await applyDiskon(page);
        await applyDiskon(page);
        await expect(page.locator('#pesan-diskon')).toHaveText('Diskon sudah diterapkan');
        await expect(page.locator('#diskon')).toHaveText('-Rp10.000');
        await expect(page.locator('#total')).toHaveText('Rp90.000');
    });

    test('TC-DS-10 belanja Rp100.000 tanpa menekan Apply Discount', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await expect(page.locator('#diskon')).toHaveText('Rp0');
        await expect(page.locator('#total')).toHaveText('Rp100.000');
    });

    test('TC-DS-11 Apply Discount saat keranjang kosong', async ({ page }) => {
        await applyDiskon(page);
        await expect(page.locator('#pesan-diskon')).toHaveText('Minimum belanja Rp100.000 untuk mendapatkan diskon');
        await expect(page.locator('#total')).toHaveText('Rp0');
    });

    test('TC-DS-12 diskon lalu bayar tunai sampai struk', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB);
        await applyDiskon(page);
        await prosesBayar(page, 'tunai');
        await expect(page.locator('#tagihan')).toHaveText('Rp90.000');
        await bayarTunai(page, 100000);
        await expect(page.locator('#kembalian')).toHaveText('Rp10.000');
        await expect(page.locator('#status')).toHaveText('Lunas');
        await selesaikanPenjualan(page);
        const struk = page.locator('#struk');
        await expect(struk).toContainText('Subtotal: Rp100.000');
        await expect(struk).toContainText('Diskon: -Rp10.000');
        await expect(struk).toContainText('Total: Rp90.000');
    });

    test('TC-DS-13 diskon lalu bayar penuh dengan QRIS', async ({ page }) => {
        await tambahBarang(page, ...BELANJA_100RB, 'mie-ayam');
        await applyDiskon(page);
        await prosesBayar(page, 'qris');
        await expect(page.locator('#nominal-qris')).toHaveText('Rp114.300');
        await page.click('#btn-qris-berhasil');
        await selesaikanPenjualan(page);
        await expect(page.locator('#struk')).toContainText('QRIS: Rp114.300');
    });
});