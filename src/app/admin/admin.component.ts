import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule, CardModule, InputTextModule, PasswordModule, ButtonModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent {
  protected username = signal('admin');
  protected password = signal('');
  protected error = signal<string | null>(null);
  protected loading = signal(false);

  constructor(private http: HttpClient, private router: Router) {}

  protected async login() {
    this.error.set(null);
    this.loading.set(true);

    this.http.post<{ success: boolean; token?: string; error?: string }>('/api/auth/login', {
      username: this.username(),
      password: this.password()
    }).subscribe({
      next: (response) => {
        if (response.success && response.token) {
          localStorage.setItem('admin_token', response.token);
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.error.set(response.error || 'Login failed');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to connect to server');
        this.loading.set(false);
      }
    });
  }
}


