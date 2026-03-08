document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');

    // Проверяем, не авторизован ли пользователь
    checkAuth();

    // Обработка отправки формы
    loginForm.addEventListener('submit', handleLogin);

    // Добавляем обработчики для красивого UI
    setupFormInteractions();
});

async function handleLogin(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
        Username: formData.get('username'),
        Password: formData.get('password')
    };

    // Валидация
    if (!data.Username || !data.Password) {
        showError('Заполните все поля');
        return;
    }

    // Показываем индикатор загрузки
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Вход...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const responseStatus = response.status;
        console.log('Login response status:', responseStatus);

        if (response.ok) {
            const result = await response.json();

            // Сохраняем данные в localStorage
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));

            // Показываем успешное сообщение
            showSuccess(`Вход выполнен успешно! Добро пожаловать, ${result.user.full_name || result.user.username}!`);

            // Перенаправляем через секунду
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1000);

        } else {
            // При любой ошибке авторизации показываем стандартное сообщение
            // Статусы 401 (Unauthorized) и 403 (Forbidden) означают неверные данные
            let errorMessage = 'Неверный логин или пароль';
            
            // Для других ошибок можем попытаться прочитать детали
            if (responseStatus !== 401 && responseStatus !== 403) {
                try {
                    const errorData = await response.text();
                    if (errorData && errorData.trim()) {
                        try {
                            const errorJson = JSON.parse(errorData);
                            if (errorJson.message) {
                                // Проверяем, не является ли это ошибкой авторизации
                                const msgLower = errorJson.message.toLowerCase();
                                if (!msgLower.includes('login') && 
                                    !msgLower.includes('password') &&
                                    !msgLower.includes('неверн') &&
                                    !msgLower.includes('unauthorized') &&
                                    !msgLower.includes('forbidden')) {
                                    errorMessage = errorJson.message;
                                }
                            }
                        } catch {
                            // Не JSON, оставляем стандартное сообщение
                        }
                    }
                } catch (e) {
                    // Игнорируем ошибки чтения, используем стандартное сообщение
                }
            }
            
            // Показываем ошибку
            showError(errorMessage);
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
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
            clearError(this);
            // Также очищаем общее сообщение об ошибке при начале ввода
            const errorMessage = document.querySelector('.error-message');
            if (errorMessage && (this.id === 'username' || this.id === 'password')) {
                errorMessage.style.opacity = '0';
                setTimeout(() => {
                    if (errorMessage.parentNode) {
                        errorMessage.parentNode.removeChild(errorMessage);
                    }
                }, 300);
            }
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
    // Удаляем старые сообщения об ошибках и успехе
    clearAllErrors();
    clearAllSuccess();

    // Создаем элемент ошибки
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">⚠️</span>
            <span>${message}</span>
        </div>
    `;

    // Вставляем сообщение в контейнер, сразу после заголовка и перед формой
    const container = document.querySelector('.auth-container');
    const form = document.getElementById('loginForm');
    
    if (container && form) {
        // Вставляем перед формой
        container.insertBefore(errorElement, form);
    } else if (container) {
        // Если форма не найдена, вставляем в конец контейнера
        container.appendChild(errorElement);
    } else {
        // Последний вариант - в body
        document.body.insertBefore(errorElement, document.body.firstChild);
    }

    // Добавляем анимацию появления
    requestAnimationFrame(() => {
        errorElement.style.opacity = '0';
        errorElement.style.transform = 'translateY(-10px)';
        errorElement.style.transition = 'all 0.3s ease';
        
        requestAnimationFrame(() => {
            errorElement.style.opacity = '1';
            errorElement.style.transform = 'translateY(0)';
        });
    });

    // Автоудаление через 8 секунд
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.style.opacity = '0';
            errorElement.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            }, 300);
        }
    }, 8000);
    
    // Также скроллим к сообщению об ошибке
    errorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showSuccess(message) {
    // Удаляем старые сообщения
    clearAllErrors();
    clearAllSuccess();

    // Создаем элемент успеха
    const successElement = document.createElement('div');
    successElement.className = 'success-message';
    successElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">✅</span>
            <span>${message}</span>
        </div>
    `;
    successElement.style.cssText = `
        color: #155724;
        font-size: 15px;
        font-weight: 500;
        margin-bottom: 20px;
        padding: 15px 20px;
        background: #d4edda;
        border: 2px solid #c3e6cb;
        border-left: 4px solid #28a745;
        border-radius: 8px;
        text-align: left;
        box-shadow: 0 2px 8px rgba(40, 167, 69, 0.15);
    `;

    // Вставляем перед формой - упрощенная логика
    const form = document.getElementById('loginForm');
    const container = document.querySelector('.auth-container');
    
    if (form && form.parentNode) {
        // Вставляем перед формой
        form.parentNode.insertBefore(successElement, form);
    } else if (container) {
        // Вставляем в контейнер перед формой
        const formInContainer = container.querySelector('.auth-form');
        if (formInContainer) {
            container.insertBefore(successElement, formInContainer);
        } else {
            // Если форма не найдена, вставляем в начало контейнера
            container.insertBefore(successElement, container.firstChild);
        }
    }

    // Анимация появления
    successElement.style.opacity = '0';
    successElement.style.transform = 'translateY(-10px)';

    setTimeout(() => {
        successElement.style.transition = 'all 0.3s ease';
        successElement.style.opacity = '1';
        successElement.style.transform = 'translateY(0)';
    }, 10);
}

function clearError(input) {
    const errorElement = input.parentElement.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
    input.style.borderColor = '';
}

function clearAllErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(msg => {
        if (msg.parentNode) {
            msg.parentNode.removeChild(msg);
        }
    });
}

function clearAllSuccess() {
    const successMessages = document.querySelectorAll('.success-message');
    successMessages.forEach(msg => {
        if (msg.parentNode) {
            msg.parentNode.removeChild(msg);
        }
    });
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        // Если пользователь уже авторизован, перенаправляем на главную
        window.location.href = 'home.html';
    }
}

// Дополнительные функции для улучшения UX
function demoLogin(username, password) {
    document.getElementById('username').value = username;
    document.getElementById('password').value = password;
}

// Добавляем возможность входа по Enter
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && document.activeElement.type !== 'button') {
        const form = document.getElementById('loginForm');
        if (form) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.click();
            }
        }
    }
});

// Показываем/скрываем пароль (опционально)
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
