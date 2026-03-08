// =====================================================
// ПРОВЕРКА ПРАВ АДМИНИСТРАТОРА
// =====================================================

(function() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Проверяем авторизацию
    if (!token || !user.username) {
        window.location.href = "login.html";
        return;
    }

    // Проверяем роль администратора
    if (user.role !== 'admin') {
        alert('Доступ запрещён. Эта страница доступна только администраторам.');
        window.location.href = "home.html";
        return;
    }
})();

