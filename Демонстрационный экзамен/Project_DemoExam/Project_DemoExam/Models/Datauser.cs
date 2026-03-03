using System;
using System.Collections.Generic;

namespace Project_DemoExam.Models;

public partial class Datauser
{
    public int Userid { get; set; }

    public string Fio { get; set; } = null!;

    public string? Phone { get; set; }

    public string Login { get; set; } = null!;

    public string Password { get; set; } = null!;

    public string Type { get; set; } = null!;

    public virtual ICollection<Datacomment> Datacomments { get; set; } = new List<Datacomment>();

    public virtual ICollection<Datarequest> DatarequestClients { get; set; } = new List<Datarequest>();

    public virtual ICollection<Datarequest> DatarequestMasters { get; set; } = new List<Datarequest>();
}
