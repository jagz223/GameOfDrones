import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface MoveRule {
  moveName: string;
  kills: string;
}

export interface RulesResponse {
  rules: MoveRule[];
}

export interface KillPair {
  killer: string;
  defeated: string;
}

export interface ReplaceRulesRequest {
  rules: KillPair[];
}

export interface PlayerStat {
  name: string;
  gamesWon: number;
}

@Injectable({ providedIn: 'root' })
export class DroneApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  getRules(): Observable<RulesResponse> {
    return this.http.get<RulesResponse>(`${this.base}/rules`);
  }

  replaceRules(body: ReplaceRulesRequest): Observable<RulesResponse> {
    return this.http.put<RulesResponse>(`${this.base}/rules`, body);
  }

  getStats(): Observable<PlayerStat[]> {
    return this.http.get<PlayerStat[]>(`${this.base}/stats`);
  }

  recordGameWon(winnerName: string): Observable<PlayerStat> {
    return this.http.post<PlayerStat>(`${this.base}/stats/game-won`, { winnerName });
  }
}
