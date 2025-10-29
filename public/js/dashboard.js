/**
 * ===================================================================
 * Kode JavaScript untuk Halaman Dashboard
 * ===================================================================
 */

// --- Fungsi-Fungsi Utilitas ---

/**
 * Menampilkan notifikasi toast (snackbar) ke pengguna.
 * @param {string} message - Pesan yang akan ditampilkan.
 * @param {'success'|'error'} type - Tipe notifikasi.
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 shadow-lg transform transition-all duration-300 ease-in-out translate-x-full ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    toast.innerHTML = `<div class="flex items-center"><i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>${message}</div>`;
    
    document.body.appendChild(toast);

    // Animasi masuk
    setTimeout(() => toast.classList.remove('translate-x-full'), 100);

    // Hapus toast setelah 3 detik
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Menampilkan modal broadcast pengumuman.
 */
function showBroadcastModal() {
    document.getElementById('broadcastModal').classList.remove('hidden');
}

/**
 * Menyembunyikan modal broadcast dan mereset formnya.
 */
function hideBroadcastModal() {
    const modal = document.getElementById('broadcastModal');
    modal.classList.add('hidden');
    
    // Reset form saat modal ditutup
    const form = document.getElementById('broadcastForm');
    if (form) form.reset();
    
    // Sembunyikan dropdown dan perbarui teks tombol
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) dropdownMenu.classList.add('hidden');
    updateDropdownTrigger();
}

/**
 * Menampilkan atau menyembunyikan menu dropdown pemilihan pelanggan.
 */
function toggleDropdown() {
    const menu = document.getElementById('dropdownMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

/**
 * Memperbarui teks pada tombol dropdown berdasarkan jumlah pelanggan yang dipilih.
 */
function updateDropdownTrigger() {
    const checkboxes = document.querySelectorAll('.customer-checkbox:checked');
    const buttonText = document.getElementById('dropdownButtonText');
    if (!buttonText) return;

    if (checkboxes.length === 0) {
        buttonText.textContent = 'Pilih pelanggan...';
        buttonText.className = 'text-gray-500';
    } else {
        buttonText.textContent = `${checkboxes.length} Pelanggan Dipilih`;
        buttonText.className = 'text-gray-800 font-medium';
    }
}


// --- Inisialisasi dan Event Listener Utama ---

document.addEventListener('DOMContentLoaded', function() {
    
    // --- Inisialisasi Chart Pendapatan ---
    const chartCtx = document.getElementById('revenueChart');
    if (chartCtx && window.monthlyRevenueData) {
        const monthlyRevenueData = window.monthlyRevenueData;
        if (monthlyRevenueData.length > 0) {
            new Chart(chartCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: monthlyRevenueData.map(item => `${item._id.month}/${item._id.year}`),
                    datasets: [{
                        label: 'Pendapatan',
                        data: monthlyRevenueData.map(item => item.total),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: function(value) { return 'Rp ' + value.toLocaleString('id-ID'); } }
                        }
                    }
                }
            });
        }
    }

    // --- Logika Dropdown dan Checkbox Pelanggan ---
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const customerCheckboxes = document.querySelectorAll('.customer-checkbox');

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            customerCheckboxes.forEach(cb => cb.checked = this.checked);
            updateDropdownTrigger();
        });
    }

    customerCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateDropdownTrigger();
            if (selectAllCheckbox) {
                const checkedCount = document.querySelectorAll('.customer-checkbox:checked').length;
                selectAllCheckbox.checked = checkedCount === customerCheckboxes.length;
                selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < customerCheckboxes.length;
            }
        });
    });

    // --- Logika Pencarian Pelanggan ---
    const customerSearch = document.getElementById('customerSearch');
    if (customerSearch) {
        customerSearch.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.customer-item');
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
            });
        });
    }

    // --- Logika Submit Form Broadcast ---
    const broadcastForm = document.getElementById('broadcastForm');
    if (broadcastForm) {
        broadcastForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';

            const recipientIds = Array.from(document.querySelectorAll('.customer-checkbox:checked')).map(cb => cb.value);
            const message = this.querySelector('textarea[name="message"]').value;

            if (recipientIds.length === 0) {
                showToast('Pilih setidaknya satu pelanggan.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                return;
            }

            try {
                const response = await fetch('/broadcast/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipientIds, message })
                });

                const result = await response.json();

                // Periksa apakah response HTTP sukses (status 200-299)
                if (!response.ok) {
                    // Jika server merespons dengan error (misal 400, 500)
                    throw new Error(result.message || `Server error: ${response.status}`);
                }

                if (result.success) {
                    showToast(result.message, 'success');
                    hideBroadcastModal();
                } else {
                    // Jika sukses secara HTTP tapi ada error logis dari server
                    showToast(result.message || 'Terjadi kesalahan yang tidak diketahui.', 'error');
                }
            } catch (error) {
                console.error('Broadcast Error:', error);
                // Tampilkan pesan error dari server jika ada, atau pesan default
                showToast(error.message || 'Gagal terhubung ke server.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // --- Event Listener untuk Menutup Dropdown ---
    window.addEventListener('click', function(e) {
        const dropdown = document.getElementById('dropdownMenu');
        const button = document.getElementById('dropdownButton');
        if (button && dropdown && !button.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
});
