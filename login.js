// login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const buttonText = document.getElementById('buttonText');
    const toastContainer = document.getElementById('toastContainer');

    function showToast(type, message, duration = 3000) {
        const toast = document.createElement('div');
        toast.classList.add('toast-notification', type);
        let icon = '';
        if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
        else if (type === 'error') icon = '<i class="fas fa-times-circle"></i>';
        else if (type === 'info') icon = '<i class="fas fa-info-circle"></i>';
        toast.innerHTML = `
            <span class="icon">${icon}</span>
            <span class="message">${message}</span>
            <button class="close-btn">&times;</button>
        `;
        toast.querySelector('.close-btn').addEventListener('click', () => toast.remove());
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // BARIS INI PENTING: MENGHENTIKAN PENGIRIMAN FORM BAWAAN
        
        loginButton.disabled = true;
        buttonText.textContent = 'Memproses...';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                showToast('success', 'Login berhasil! Mengalihkan ke dashboard...');
                
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);

            } else {
                showToast('error', data.message || 'Login gagal.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('error', 'Terjadi kesalahan jaringan.');
        } finally {
            loginButton.disabled = false;
            buttonText.textContent = 'Login';
        }
    });
});
