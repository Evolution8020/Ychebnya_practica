using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace Project_DemoExam.ViewModels;

public sealed class RequestEditViewModel
{
    public int Requestid { get; set; }

    [Required(ErrorMessage = "Укажите статус")]
    [StringLength(50)]
    public string Requeststatus { get; set; } = "";

    [Required(ErrorMessage = "Опишите проблему")]
    public string Problemdesc { get; set; } = "";

    public int? Masterid { get; set; }

    public List<SelectListItem> Masters { get; set; } = new();
}

