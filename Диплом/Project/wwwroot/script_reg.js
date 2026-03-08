document.addEventListener('DOMContentLoaded', function () {
    const registerForm = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // Проверяем, не авторизован ли пользователь
    checkAuth();

    // Загружаем список подразделений
    loadDepartments();

    // Настраиваем валидацию паролей
    setupPasswordValidation();

    // Обработка отправки формы
    registerForm.addEventListener('submit', handleRegister);

    // Добавляем обработчики для UI
    setupFormInteractions();
});

// Загрузка подразделений
async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        if (response.ok) {
            const departments = await response.json();
            const select = document.getElementById('department');

            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.id;
                option.textContent = dept.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки подразделений:', error);
    }
}

// Валидация паролей
function setupPasswordValidation() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');

    confirmPassword.addEventListener('input', function () {
        if (password.value !== confirmPassword.value) {
            confirmPassword.setCustomValidity('Пароли не совпадают');
            showFieldError(confirmPassword, 'Пароли не совпадают');
        } else {
            confirmPassword.setCustomValidity('');
            clearFieldError(confirmPassword);
        }
    });

    // Валидация сложности пароля
    password.addEventListener('input', function () {
        if (this.value.length < 6) {
            showFieldError(this, 'Пароль должен содержать минимум 6 символов');
        } else {
            clearFieldError(this);
        }
    });
}

// Обработка регистрации
async function handleRegister(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    // Проверка паролей
    if (password !== confirmPassword) {
        showError('Пароли не совпадают');
        return;
    }

    if (password.length < 6) {
        showError('Пароль должен содержать минимум 6 символов');
        return;
    }

    const data = {
        Username: formData.get('username'),
        Password: password,
        FullName: formData.get('fullName'),
        Email: formData.get('email')
    };

    // Показываем индикатор загрузки
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Регистрация...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showSuccess('Регистрация успешна! Теперь вы можете войти в систему.');

            // Перенаправляем через 2 секунды
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } else {
            const error = await response.json();
            showError(error.message || 'Ошибка регистрации');
        }
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showError('Ошибка соединения с сервером');
    } finally {
        // Восстанавливаем кнопку
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function setupFormInteractions() {
    const inputs = document.querySelectorAll('input');

    inputs.forEach(input => {
        // Очищаем ошибку при вводе
        input.addEventListener('input', function () {
            clearFieldError(this);
        });

        // Подсветка при фокусе
        input.addEventListener('focus', function () {
            this.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', function () {
            this.parentElement.classList.remove('focused');
        });
    });
}

function showError(message) {
    clearAllErrors();

    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.cssText = `
                color: #dc3545;
                font-size: 14px;
                margin-top: 10px;
                padding: 10px;
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 6px;
                text-align: center;
            `;

    const form = document.getElementById('registerForm');
    form.parentNode.insertBefore(errorElement, form);

    errorElement.style.opacity = '0';
    errorElement.style.transform = 'translateY(-10px)';

    setTimeout(() => {
        errorElement.style.transition = 'all 0.3s ease';
        errorElement.style.opacity = '1';
        errorElement.style.transform = 'translateY(0)';
    }, 10);
}

function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'success-message';
    successElement.textContent = message;
    successElement.style.cssText = `
                color: #155724;
                font-size: 14px;
                margin-top: 10px;
                padding: 10px;
                background: #d4edda;
                border: 1px solid #c3e6cb;
                border-radius: 6px;
                text-align: center;
            `;

    const form = document.getElementById('registerForm');
    form.parentNode.insertBefore(successElement, form);

    successElement.style.opacity = '0';
    successElement.style.transform = 'translateY(-10px)';

    setTimeout(() => {
        successElement.style.transition = 'all 0.3s ease';
        successElement.style.opacity = '1';
        successElement.style.transform = 'translateY(0)';
    }, 10);
}

function showFieldError(input, message) {
    clearFieldError(input);

    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.cssText = `
                color: #dc3545;
                font-size: 12px;
                margin-top: 4px;
            `;

    input.parentNode.appendChild(errorElement);
    input.style.borderColor = '#dc3545';
}

function clearFieldError(input) {
    const errorElement = input.parentElement.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
    input.style.borderColor = '';
}

function clearAllErrors() {
    const errorMessages = document.querySelectorAll('.error-message, .success-message');
    errorMessages.forEach(msg => msg.remove());
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = 'home.html';
    }
}

// Добавляем возможность входа по Enter
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && document.activeElement.type !== 'button') {
        const form = document.getElementById('registerForm');
        if (form) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.click();
            }
        }
    }
});

// Показываем/скрываем пароль
function setupPasswordToggle() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');

    passwordInputs.forEach(input => {
        // Проверяем, не добавлена ли уже кнопка
        if (input.parentElement.querySelector('.password-toggle-btn')) {
            return; // Кнопка уже добавлена
        }

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'password-toggle-btn';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.setAttribute('aria-label', 'Показать пароль');

        const inputWrapper = input.parentElement;
        // Убеждаемся, что родитель имеет position: relative (уже есть в CSS)
        
        inputWrapper.appendChild(toggleBtn);

        toggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.innerHTML = '🔒';
            } else {
                input.type = 'password';
                toggleBtn.innerHTML = '👁️';
            }
        });
    });
}

// Инициализируем переключатели пароля
setupPasswordToggle();