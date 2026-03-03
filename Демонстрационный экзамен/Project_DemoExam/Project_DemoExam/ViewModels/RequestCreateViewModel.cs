using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace Project_DemoExam.ViewModels;

public sealed class RequestCreateViewModel
{
    [Required(ErrorMessage = "Укажите тип оборудования")]
    [StringLength(100)]
    public string Orgtechtype { get; set; } = "";

    [Required(ErrorMessage = "Укажите модель")]
    [StringLength(100)]
    public string Orgtechmodel { get; set; } = "";

    [Required(ErrorMessage = "Опишите проблему")]
    public string Problemdesc { get; set; } = "";

    [StringLength(150)]
    public string? ClientFio { get; set; }

    public int? ClientId { get; set; }

    public List<SelectListItem> Clients { get; set; } = new();
}

