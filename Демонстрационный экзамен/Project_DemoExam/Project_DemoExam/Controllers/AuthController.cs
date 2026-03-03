using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Project_DemoExam.Models;

namespace Project_DemoExam.Controllers;

[AllowAnonymous]
public sealed class AuthController : Controller
{
    private readonly AppDbContext _context;

    public AuthController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        ViewBag.ReturnUrl = returnUrl;
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Login(string login, string password, string? returnUrl = null)
    {
        login = (login ?? "").Trim();
        password = password ?? "";

        if (string.IsNullOrWhiteSpace(login) || string.IsNullOrWhiteSpace(password))
        {
            ModelState.AddModelError(string.Empty, "Введите логин и пароль.");
            ViewBag.ReturnUrl = returnUrl;
            return View();
        }

        var user = _context.Datausers
            .AsNoTracking()
            .FirstOrDefault(u => u.Login == login);

        if (user is null || user.Password != password)
        {
            ModelState.AddModelError(string.Empty, "Неверный логин или пароль.");
            ViewBag.ReturnUrl = returnUrl;
            return View();
        }

        // Роль пользователя из поля datausers.type
        var role = GetRoleFromType(user.Type);

        // Claims попадут в auth-cookie
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Userid.ToString()),
            new(ClaimTypes.Name, user.Fio),
            new(ClaimTypes.Role, role)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        // Ставим auth-cookie
        HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties { IsPersistent = true }).GetAwaiter().GetResult();

        if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            return Redirect(returnUrl);
        }

        return RedirectToAction("Index", "Home");
    }

    [Authorize]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Logout()
    {
        // Снимаем auth-cookie
        HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme).GetAwaiter().GetResult();
        return RedirectToAction(nameof(Login));
    }

    [HttpGet]
    public IActionResult AccessDenied()
    {
        return View();
    }

    private static string GetRoleFromType(string type)
    {
        // Нормализуем строковый тип из БД в роль приложения
        if (string.IsNullOrWhiteSpace(type)) return "Client";

        var t = type.Trim().ToLowerInvariant();

        if (t.Contains("client") || t.Contains("клиент") || t.Contains("заказчик"))
            return "Client";

        // Оператор
        if (t.Contains("оператор") || t.Contains("operator"))
            return "Operator";

        // Менеджер по качеству
        if (t.Contains("кач") || t.Contains("quality") || t.Contains("менеджер"))
            return "QualityManager";

        // Специалист/мастер
        return "Specialist";
    }
}

