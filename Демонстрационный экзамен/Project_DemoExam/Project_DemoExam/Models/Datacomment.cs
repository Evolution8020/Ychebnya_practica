using System;
using System.Collections.Generic;

namespace Project_DemoExam.Models;

public partial class Datacomment
{
    public int Commentid { get; set; }

    public string Message { get; set; } = null!;

    public int Masterid { get; set; }

    public int Requestid { get; set; }

    public virtual Datauser Master { get; set; } = null!;

    public virtual Datarequest Request { get; set; } = null!;
}
