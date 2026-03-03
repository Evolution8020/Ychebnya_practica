using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace Project_DemoExam.Models;

public partial class AppDbContext : DbContext
{
    public AppDbContext()
    {
    }

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Datacomment> Datacomments { get; set; }

    public virtual DbSet<Datarequest> Datarequests { get; set; }

    public virtual DbSet<Datauser> Datausers { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
        => optionsBuilder.UseNpgsql("Host=localhost;Port=5432;Database=Demoexams;Username=postgres;Password=admin");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Datacomment>(entity =>
        {
            entity.HasKey(e => e.Commentid).HasName("datacomments_pkey");

            entity.ToTable("datacomments");

            entity.Property(e => e.Commentid).ValueGeneratedOnAdd().HasColumnName("commentid");
            entity.Property(e => e.Masterid).HasColumnName("masterid");
            entity.Property(e => e.Message).HasColumnName("message");
            entity.Property(e => e.Requestid).HasColumnName("requestid");

            entity.HasOne(d => d.Master).WithMany(p => p.Datacomments)
                .HasForeignKey(d => d.Masterid)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("datacomments_masterid_fkey");

            entity.HasOne(d => d.Request).WithMany(p => p.Datacomments)
                .HasForeignKey(d => d.Requestid)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("datacomments_requestid_fkey");
        });

        modelBuilder.Entity<Datarequest>(entity =>
        {
            entity.HasKey(e => e.Requestid).HasName("datarequests_pkey");

            entity.ToTable("datarequests");

            entity.Property(e => e.Requestid).ValueGeneratedOnAdd().HasColumnName("requestid");
            entity.Property(e => e.Clientid).HasColumnName("clientid");
            entity.Property(e => e.Completiondate).HasColumnName("completiondate");
            entity.Property(e => e.Masterid).HasColumnName("masterid");
            entity.Property(e => e.Orgtechmodel)
                .HasMaxLength(100)
                .HasColumnName("orgtechmodel");
            entity.Property(e => e.Orgtechtype)
                .HasMaxLength(100)
                .HasColumnName("orgtechtype");
            entity.Property(e => e.Problemdesc).HasColumnName("problemdesc");
            entity.Property(e => e.Repairparts).HasColumnName("repairparts");
            entity.Property(e => e.Requeststatus)
                .HasMaxLength(50)
                .HasColumnName("requeststatus");
            entity.Property(e => e.Startdate).HasColumnName("startdate");

            entity.HasOne(d => d.Client).WithMany(p => p.DatarequestClients)
                .HasForeignKey(d => d.Clientid)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("datarequests_clientid_fkey");

            entity.HasOne(d => d.Master).WithMany(p => p.DatarequestMasters)
                .HasForeignKey(d => d.Masterid)
                .HasConstraintName("datarequests_masterid_fkey");
        });

        modelBuilder.Entity<Datauser>(entity =>
        {
            entity.HasKey(e => e.Userid).HasName("datausers_pkey");

            entity.ToTable("datausers");

            entity.Property(e => e.Userid).ValueGeneratedOnAdd().HasColumnName("userid");
            entity.Property(e => e.Fio)
                .HasMaxLength(150)
                .HasColumnName("fio");
            entity.Property(e => e.Login)
                .HasMaxLength(50)
                .HasColumnName("login");
            entity.Property(e => e.Password)
                .HasMaxLength(50)
                .HasColumnName("password");
            entity.Property(e => e.Phone)
                .HasMaxLength(20)
                .HasColumnName("phone");
            entity.Property(e => e.Type)
                .HasMaxLength(50)
                .HasColumnName("type");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
