using System;
using System.Collections.Generic;

namespace Project_DemoExam.Models;

public partial class Datarequest
{
    public int Requestid { get; set; }

    public DateOnly Startdate { get; set; }

    public string Orgtechtype { get; set; } = null!;

    public string Orgtechmodel { get; set; } = null!;

    public string Problemdesc { get; set; } = null!;

    public string Requeststatus { get; set; } = null!;

    public DateOnly? Completiondate { get; set; }

    public string? Repairparts { get; set; }

    public int? Masterid { get; set; }

    public int Clientid { get; set; }

    public virtual Datauser Client { get; set; } = null!;

    public virtual ICollection<Datacomment> Datacomments { get; set; } = new List<Datacomment>();

    public virtual Datauser? Master { get; set; }
}
