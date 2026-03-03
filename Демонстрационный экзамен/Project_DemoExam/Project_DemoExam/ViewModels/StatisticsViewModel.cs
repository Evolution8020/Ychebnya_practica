namespace Project_DemoExam.ViewModels;

public sealed class StatisticsViewModel
{
    public int CompletedCount { get; init; }
    public double? AverageRepairDays { get; init; }

    public required IReadOnlyList<(string FaultType, int Count)> FaultTypeStats { get; init; }
}

