import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface MoveRule {
  moveName: string;
  kills: string;
}

export interface TiePair {
  moveA: string;
  moveB: string;
}

export interface RulesResponse {
  rules: MoveRule[];
  ties: TiePair[];
}

export interface KillPair {
  killer: string;
  defeated: string;
}

export interface ReplaceRulesRequest {
  rules: KillPair[];
  ties: TiePair[];
}

export interface PlayerStat {
  name: string;
  gamesWon: number;
}

export interface CreateRoomResponse {
  roomId: string;
}

export interface JoinRoomResponse {
  roomId: string;
  player1Name: string;
  player2Name: string;
}

export interface ResolvedRound {
  round: number;
  label: string;
  p1Move: string;
  p2Move: string;
}

export interface MoveResponse {
  waitingForOpponent: boolean;
  roundResolved: ResolvedRound | null;
  p1Wins: number;
  p2Wins: number;
  round: number;
  phase: string;
  winnerName: string | null;
}

export interface RoomState {
  roomId: string;
  phase: string;
  player1Name: string;
  player2Name: string | null;
  round: number;
  p1Wins: number;
  p2Wins: number;
  askingPlayer: number;
  opponentJoined: boolean;
  yourMoveSubmitted: boolean;
  opponentMoveSubmitted: boolean;
  resolvedRound: ResolvedRound | null;
  winnerName: string | null;
  youWantRematch: boolean;
  opponentWantsRematch: boolean;
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

  resetRulesToClassic(): Observable<RulesResponse> {
    return this.http.post<RulesResponse>(`${this.base}/rules/reset`, {});
  }

  getStats(): Observable<PlayerStat[]> {
    return this.http.get<PlayerStat[]>(`${this.base}/stats`);
  }

  recordGameWon(winnerName: string): Observable<PlayerStat> {
    return this.http.post<PlayerStat>(`${this.base}/stats/game-won`, { winnerName });
  }

  createRoom(player1Name: string): Observable<CreateRoomResponse> {
    return this.http.post<CreateRoomResponse>(`${this.base}/rooms`, { player1Name });
  }

  joinRoom(roomId: string, player2Name: string): Observable<JoinRoomResponse> {
    return this.http.post<JoinRoomResponse>(`${this.base}/rooms/join`, { roomId, player2Name });
  }

  getRoomState(roomId: string, player: 1 | 2): Observable<RoomState> {
    return this.http.get<RoomState>(`${this.base}/rooms/${encodeURIComponent(roomId)}`, {
      params: { player: String(player) },
    });
  }

  submitRoomMove(roomId: string, body: { player: number; move: string }): Observable<MoveResponse> {
    return this.http.post<MoveResponse>(
      `${this.base}/rooms/${encodeURIComponent(roomId)}/move`,
      body,
    );
  }

  requestRematch(roomId: string, player: 1 | 2): Observable<RoomState> {
    return this.http.post<RoomState>(`${this.base}/rooms/${encodeURIComponent(roomId)}/rematch`, {
      player,
    });
  }
}
