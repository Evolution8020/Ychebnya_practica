using Project_DemoExam.Models;

namespace Project_DemoExam.ViewModels;

public sealed class RequestIndexViewModel
{
    public required IReadOnlyList<Datarequest> Requests { get; init; }
    public string? Query { get; init; }
    public string? Status { get; init; }
}

