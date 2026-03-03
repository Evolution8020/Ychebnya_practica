using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Data;
using Npgsql;
using Project_DemoExam.Models;
using Project_DemoExam.ViewModels;


namespace Project_DemoExam.Controllers
{
    [Authorize]
    public class HomeController : Controller
    {
        private readonly AppDbContext _context;

        public HomeController(AppDbContext context)
        {
            _context = context;
        }

        public IActionResult Index(string? q, string? status)
        {
            var requestsQuery = _context.Datarequests
                .AsNoTracking()
                .Include(r => r.Client)
                .AsQueryable();

            if (User.IsInRole("Client"))
            {
                // Клиент видит только свои заявки
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(userIdStr, out var userId))
                {
                    requestsQuery = requestsQuery.Where(r => r.Clientid == userId);
                }
            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                var query = q.Trim();

                if (int.TryParse(query, out var requestId))
                {
                    requestsQuery = requestsQuery.Where(r => r.Requestid == requestId);
                }
                else
                {
                    var like = $"%{query}%";
                    requestsQuery = requestsQuery.Where(r =>
                        EF.Functions.ILike(r.Orgtechtype, like) ||
                        EF.Functions.ILike(r.Orgtechmodel, like) ||
                        EF.Functions.ILike(r.Problemdesc, like) ||
                        EF.Functions.ILike(r.Client.Fio, like));
                }
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                var s = status.Trim();
                requestsQuery = requestsQuery.Where(r => r.Requeststatus == s);
            }

            var requests = requestsQuery
                .OrderByDescending(r => r.Requestid)
                .ToList();

            var vm = new RequestIndexViewModel
            {
                Requests = requests,
                Query = q,
                Status = status
            };

            return View(vm);
        }

        [HttpGet]
        [Authorize(Roles = "Client,Specialist")]
        public IActionResult Create()
        {
            return View(new RequestCreateViewModel());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Roles = "Client,Specialist")]
        public IActionResult Create(RequestCreateViewModel model)
        {
            if (!ModelState.IsValid)
            {
                if (User.IsInRole("Specialist"))
                {
                    model.Clients = GetClientSelectList();
                }
                return View(model);
            }

            try
            {
                Datauser? client = null;

                if (User.IsInRole("Client"))
                {
                    var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                    if (int.TryParse(userIdStr, out var userId))
                    {
                        client = _context.Datausers.FirstOrDefault(u => u.Userid == userId);
                    }
                }
                else
                {
                    if (model.ClientId is null)
                    {
                        ModelState.AddModelError(nameof(model.ClientId), "Выберите заказчика.");
                    }
                    else
                    {
                        client = _context.Datausers.FirstOrDefault(u =>
                            u.Userid == model.ClientId.Value &&
                            (EF.Functions.ILike(u.Type, "%client%") || EF.Functions.ILike(u.Type, "%клиент%")));
                        if (client is null)
                        {
                            ModelState.AddModelError(nameof(model.ClientId), "Выбранный заказчик не найден.");
                        }
                    }
                }

                if (!ModelState.IsValid || client is null)
                {
                    if (User.IsInRole("Specialist"))
                    {
                        model.Clients = GetClientSelectList();
                    }
                    return View(model);
                }

                var request = new Datarequest
                {
                    Startdate = DateOnly.FromDateTime(DateTime.Today),
                    Orgtechtype = model.Orgtechtype.Trim(),
                    Orgtechmodel = model.Orgtechmodel.Trim(),
                    Problemdesc = model.Problemdesc.Trim(),
                    Requeststatus = "Новая",
                    Clientid = client.Userid,
                    Masterid = null,
                    Completiondate = null,
                    Repairparts = null
                };

                _context.Datarequests.Add(request);
                SaveChangesWithReseedOnPkConflict("datarequests", "requestid");
            }
            catch (DbUpdateException ex)
            {
                var msg = ex.GetBaseException().Message;
                ModelState.AddModelError(string.Empty, "Ошибка сохранения в базе данных: " + msg);
                if (User.IsInRole("Specialist"))
                {
                    model.Clients = GetClientSelectList();
                }
                return View(model);
            }

            return RedirectToAction(nameof(Index));
        }

        private void SaveChangesWithReseedOnPkConflict(string table, string column)
        {
            try
            {
                _context.SaveChanges();
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg &&
                                              pg.SqlState == "23505" &&
                                              string.Equals(pg.ConstraintName, $"{table}_pkey", StringComparison.Ordinal))
            {
                // Если sequence PK отстала — пересинхронизируем и повторим сохранение
                TryReseedSerialSequence(table, column);
                _context.SaveChanges();
            }
        }

        private void TryReseedSerialSequence(string table, string column)
        {
            if (!((table == "datausers" && column == "userid") ||
                  (table == "datarequests" && column == "requestid") ||
                  (table == "datacomments" && column == "commentid")))
            {
                return;
            }

            // Ресидим sequence через pg_get_serial_sequence + setval(max(id))
            var conn = _context.Database.GetDbConnection();
            var shouldClose = conn.State != ConnectionState.Open;
            if (shouldClose)
            {
                conn.Open();
            }

            try
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT pg_get_serial_sequence(@t, @c);";

                    var pT = cmd.CreateParameter();
                    pT.ParameterName = "@t";
                    pT.Value = table;
                    cmd.Parameters.Add(pT);

                    var pC = cmd.CreateParameter();
                    pC.ParameterName = "@c";
                    pC.Value = column;
                    cmd.Parameters.Add(pC);

                    var seq = cmd.ExecuteScalar() as string;
                    if (string.IsNullOrWhiteSpace(seq))
                    {
                        return;
                    }

                    cmd.Parameters.Clear();
                    cmd.CommandText = $"SELECT setval(@seq::regclass, (SELECT COALESCE(MAX({column}),0) FROM {table}), true);";
                    var pSeq = cmd.CreateParameter();
                    pSeq.ParameterName = "@seq";
                    pSeq.Value = seq;
                    cmd.Parameters.Add(pSeq);

                    cmd.ExecuteNonQuery();
                }
            }
            finally
            {
                if (shouldClose)
                {
                    conn.Close();
                }
            }
        }

        private List<SelectListItem> GetClientSelectList()
        {
            var clients = _context.Datausers
                .AsNoTracking()
                .Where(u =>
                    EF.Functions.ILike(u.Type, "%client%") ||
                    EF.Functions.ILike(u.Type, "%клиент%") ||
                    EF.Functions.ILike(u.Type, "%заказчик%"))
                .OrderBy(u => u.Fio)
                .ToList();

            return clients
                .Select(u => new SelectListItem
                {
                    Value = u.Userid.ToString(),
                    Text = string.IsNullOrWhiteSpace(u.Phone) ? u.Fio : $"{u.Fio} ({u.Phone})"
                })
                .ToList();
        }

        [HttpGet]
        [Authorize(Roles = "Specialist,Client")]
        public IActionResult Edit(int id)
        {
            var request = _context.Datarequests
                .AsNoTracking()
                .FirstOrDefault(r => r.Requestid == id);

            if (request is null)
            {
                return NotFound();
            }

            if (User.IsInRole("Client"))
            {
                // Клиент может редактировать только свою заявку
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(userIdStr, out var userId) || request.Clientid != userId)
                {
                    return Forbid();
                }
            }

            var masters = GetMastersForSelect();

            var vm = new RequestEditViewModel
            {
                Requestid = request.Requestid,
                Requeststatus = request.Requeststatus,
                Problemdesc = request.Problemdesc,
                Masterid = request.Masterid,
                Masters = masters
            };

            return View(vm);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Roles = "Specialist,Client")]
        public IActionResult Edit(int id, RequestEditViewModel model)
        {
            if (id != model.Requestid)
            {
                return BadRequest();
            }

            if (!ModelState.IsValid)
            {
                model.Masters = GetMastersForSelect();
                return View(model);
            }

            var request = _context.Datarequests.FirstOrDefault(r => r.Requestid == id);
            if (request is null)
            {
                return NotFound();
            }
            if (User.IsInRole("Client"))
            {
                // Повторная проверка на POST
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(userIdStr, out var userId) || request.Clientid != userId)
                {
                    return Forbid();
                }
            }

            if (!User.IsInRole("Client"))
            {
                // Статус и мастер меняют только сотрудники
                request.Requeststatus = model.Requeststatus.Trim();
                request.Masterid = model.Masterid;

                if (request.Requeststatus == "Выполнено" || request.Requeststatus == "Готово")
                {
                    // Дата завершения нужна для статистики
                    request.Completiondate ??= DateOnly.FromDateTime(DateTime.Today);
                }
            }
            request.Problemdesc = model.Problemdesc.Trim();

            try
            {
                _context.SaveChanges();
            }
            catch (DbUpdateException ex)
            {
                model.Masters = GetMastersForSelect();
                ModelState.AddModelError(string.Empty, "Ошибка сохранения в базе данных: " + ex.GetBaseException().Message);
                return View(model);
            }

            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Roles = "Specialist,Client")]
        public IActionResult Delete(int id)
        {
            var request = _context.Datarequests
                .Include(r => r.Datacomments)
                .FirstOrDefault(r => r.Requestid == id);

            if (request is null)
            {
                return NotFound();
            }

            if (User.IsInRole("Client"))
            {
                // Клиент может удалить только свою заявку
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(userIdStr, out var userId) || request.Clientid != userId)
                {
                    return Forbid();
                }
            }

            if (request.Datacomments.Count > 0)
            {
                _context.Datacomments.RemoveRange(request.Datacomments);
            }

            _context.Datarequests.Remove(request);
            try
            {
                _context.SaveChanges();
            }
            catch (DbUpdateException ex)
            {
                TempData["Error"] = "Ошибка удаления из базы данных: " + ex.GetBaseException().Message;
            }

            return RedirectToAction(nameof(Index));
        }

        [HttpGet]
        [Authorize(Roles = "Specialist")]
        public IActionResult Statistics()
        {
            var completed = _context.Datarequests
                .AsNoTracking()
                .Where(r => r.Completiondate != null || r.Requeststatus == "Выполнено" || r.Requeststatus == "Готово")
                .Select(r => new { r.Startdate, r.Completiondate, r.Problemdesc, r.Requeststatus })
                .ToList();

            var completedCount = completed.Count;

            var durations = completed
                .Where(r => r.Completiondate != null)
                .Select(r => r.Completiondate!.Value.DayNumber - r.Startdate.DayNumber)
                .Where(d => d >= 0)
                .ToList();

            double? avgDays = durations.Count == 0 ? null : durations.Average();

            var faultStats = completed
                .Select(r => (r.Problemdesc ?? "").Trim())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .GroupBy(s => s, StringComparer.OrdinalIgnoreCase)
                .Select(g => (FaultType: g.Key, Count: g.Count()))
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.FaultType)
                .Take(10)
                .ToList();

            var vm = new StatisticsViewModel
            {
                CompletedCount = completedCount,
                AverageRepairDays = avgDays,
                FaultTypeStats = faultStats
            };

            return View(vm);
        }

        private List<SelectListItem> GetMastersForSelect()
        {
            var masters = _context.Datausers
                .AsNoTracking()
                .Where(u =>
                    !(EF.Functions.ILike(u.Type, "%client%") ||
                      EF.Functions.ILike(u.Type, "%клиент%") ||
                      EF.Functions.ILike(u.Type, "%заказчик%")) &&
                    (EF.Functions.ILike(u.Type, "%master%") ||
                     EF.Functions.ILike(u.Type, "%мастер%") ||
                     EF.Functions.ILike(u.Type, "%специалист%") ||
                     EF.Functions.ILike(u.Type, "%оператор%") ||
                     EF.Functions.ILike(u.Type, "%менеджер%") ||
                     EF.Functions.ILike(u.Type, "%инженер%") ||
                     EF.Functions.ILike(u.Type, "%tech%")))
                .OrderBy(u => u.Fio)
                .Select(u => new SelectListItem { Value = u.Userid.ToString(), Text = u.Fio })
                .ToList();

            masters.Insert(0, new SelectListItem { Value = "", Text = "Не назначен" });
            return masters;
        }
    }
}
