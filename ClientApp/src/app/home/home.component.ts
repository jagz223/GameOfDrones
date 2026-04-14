import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DroneApiService,
  KillPair,
  MoveRule,
  MoveResponse,
  PlayerStat,
  RoomState,
} from '../services/drone-api.service';
import { validatePlayerDisplayName } from '../utils/player-name';

type Phase =
  | 'splash'
  | 'intro'
  | 'online-lobby'
  | 'online-host-name'
  | 'online-host-wait'
  | 'online-join'
  | 'names'
  | 'play'
  | 'online-play'
  | 'gameover'
  | 'rules';

type GameMode = 'local' | 'online' | null;

interface RoundRow {
  round: number;
  label: string;
}

interface SessionMatchEntry {
  winnerName: string;
  at: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly api = inject(DroneApiService);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private copyToastHideTimer: ReturnType<typeof setTimeout> | null = null;

  phase: Phase = 'splash';
  gameMode: GameMode = null;
  loading = false;
  error: string | null = null;

  rules: MoveRule[] = [];
  moveOptions: string[] = [];

  player1Name = '';
  player2Name = '';

  round = 1;
  p1Wins = 0;
  p2Wins = 0;
  roundRows: RoundRow[] = [];
  pendingP1: string | null = null;
  currentMove = '';

  winnerName: string | null = null;

  rulesDraft: KillPair[] = [];
  newKiller = '';
  newDefeated = '';

  onlinePlayerRole: 1 | 2 | null = null;
  onlineRoomId = '';
  onlineRoomState: RoomState | null = null;
  onlineJoinRoomIdInput = '';
  onlineJoinNameInput = '';

  copyToastVisible = false;

  sessionMatchHistory: SessionMatchEntry[] = [];

  rematchLoading = false;

  splashLeaving = false;

  historialView: 'session' | 'global' = 'session';
  stats: PlayerStat[] = [];
  statsLoading = false;
  private statsFetchedAt = 0;
  private readonly statsCacheTtlMs = 60_000;

  private onlineGlobalWinRecordedToken: string | null = null;

  ngOnInit(): void {
    this.refreshRules();
    this.refreshStats();
  }

  ngOnDestroy(): void {
    this.clearPoll();
    if (this.copyToastHideTimer !== null) {
      clearTimeout(this.copyToastHideTimer);
    }
  }

  dismissSplash(): void {
    if (this.phase !== 'splash') {
      return;
    }
    this.splashLeaving = true;
    window.setTimeout(() => {
      this.phase = 'intro';
      this.splashLeaving = false;
    }, 420);
  }

  setHistorialView(view: 'session' | 'global'): void {
    this.historialView = view;
    if (view === 'global') {
      this.refreshStats();
    }
  }

  refreshStats(force = false): void {
    const age = Date.now() - this.statsFetchedAt;
    if (!force && this.statsFetchedAt > 0 && age < this.statsCacheTtlMs) {
      return;
    }
    this.statsLoading = true;
    this.api.getStats().subscribe({
      next: (list) => {
        this.stats = list;
        this.statsFetchedAt = Date.now();
        this.statsLoading = false;
      },
      error: () => {
        this.statsLoading = false;
      },
    });
  }

  globalWinCounts(): { name: string; wins: number }[] {
    return [...this.stats]
      .map((x) => ({ name: x.name, wins: x.gamesWon }))
      .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, 'es'));
  }

  refreshRules(): void {
    this.api.getRules().subscribe({
      next: (r) => {
        this.rules = r.rules;
        this.moveOptions = this.buildMoveOptions(r.rules);
        if (this.moveOptions.length > 0 && !this.currentMove) {
          this.currentMove = this.moveOptions[0];
        }
      },
      error: () => this.setError('No se pudieron cargar las reglas del servidor.'),
    });
  }

  chooseLocalMode(): void {
    this.gameMode = 'local';
    this.phase = 'names';
    this.clearSessionMatchHistory();
    this.clearError();
  }

  chooseOnlineMode(): void {
    this.gameMode = 'online';
    this.phase = 'online-lobby';
    this.clearOnlineSession();
    this.clearError();
  }

  onlineGoCreate(): void {
    this.clearError();
    this.resetClassicRulesForOnlineLobbyEntry();
    this.phase = 'online-host-name';
    this.player1Name = '';
  }

  onlineGoJoin(): void {
    this.clearError();
    this.resetClassicRulesForOnlineLobbyEntry();
    this.phase = 'online-join';
    this.onlineJoinRoomIdInput = '';
    this.onlineJoinNameInput = '';
  }

  onlineBackToLobby(): void {
    this.clearPoll();
    this.phase = 'online-lobby';
    this.clearOnlineSession();
    this.clearError();
  }

  onlineSubmitHostName(): void {
    const n = this.player1Name.trim();
    if (!n) {
      this.setError('Escribe tu nombre (jugador 1).');
      return;
    }
    const bad = validatePlayerDisplayName(n);
    if (bad) {
      this.setError(bad);
      return;
    }
    this.loading = true;
    this.clearError();
    this.api.createRoom(n).subscribe({
      next: (res) => {
        this.loading = false;
        this.onlineRoomId = res.roomId;
        this.onlinePlayerRole = 1;
        this.phase = 'online-host-wait';
        this.startOnlineHostWaitPoll();
      },
      error: (e) => {
        this.loading = false;
        this.setError(this.httpErrorMessage(e));
      },
    });
  }

  onlineSubmitJoin(): void {
    const rid = this.onlineJoinRoomIdInput.trim().toUpperCase();
    const n = this.onlineJoinNameInput.trim();
    if (!rid) {
      this.setError('Escribe el ID de la sala.');
      return;
    }
    if (!n) {
      this.setError('Escribe tu nombre (jugador 2).');
      return;
    }
    const bad = validatePlayerDisplayName(n);
    if (bad) {
      this.setError(bad);
      return;
    }
    this.loading = true;
    this.clearError();
    this.api.joinRoom(rid, n).subscribe({
      next: () => {
        this.loading = false;
        this.onlineRoomId = rid;
        this.onlinePlayerRole = 2;
        this.phase = 'online-play';
        this.startOnlinePlayPoll();
      },
      error: (e) => {
        this.loading = false;
        this.setError(this.httpErrorMessage(e));
      },
    });
  }

  confirmOnlineMove(): void {
    if (!this.currentMove || !this.onlineRoomId || !this.onlinePlayerRole) {
      this.setError('Selecciona un movimiento.');
      return;
    }
    if (this.onlineRoomState?.phase !== 'playing') {
      return;
    }
    if (this.onlineRoomState.yourMoveSubmitted) {
      return;
    }
    this.clearError();
    this.api
      .submitRoomMove(this.onlineRoomId, { player: this.onlinePlayerRole, move: this.currentMove })
      .subscribe({
        next: (m) => this.applyMoveResponse(m),
        error: (e) => this.setError(this.httpErrorMessage(e)),
      });
  }

  async copyRoomId(): Promise<void> {
    const text = this.onlineRoomId?.trim();
    if (!text) {
      return;
    }
    let ok = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      ok = this.fallbackCopyToClipboard(text);
    }
    if (ok) {
      this.flashCopyToast();
    }
  }

  requestRematchOnline(): void {
    if (!this.onlineRoomId || !this.onlinePlayerRole || this.rematchLoading) {
      return;
    }
    this.clearError();
    this.rematchLoading = true;
    this.api.requestRematch(this.onlineRoomId, this.onlinePlayerRole).subscribe({
      next: (s) => {
        this.rematchLoading = false;
        this.onlineRoomState = s;
        if (s.phase === 'playing') {
          this.winnerName = null;
          this.phase = 'online-play';
          this.startOnlinePlayPoll();
        }
      },
      error: (e) => {
        this.rematchLoading = false;
        this.setError(this.httpErrorMessage(e));
      },
    });
  }

  sessionWinCounts(): { name: string; wins: number }[] {
    const map = new Map<string, number>();
    for (const m of this.sessionMatchHistory) {
      map.set(m.winnerName, (map.get(m.winnerName) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, wins]) => ({ name, wins }))
      .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, 'es'));
  }

  rematchButtonLabel(): string {
    if (this.rematchLoading) {
      return 'Enviando…';
    }
    if (this.onlineRoomState?.youWantRematch) {
      return 'Revancha enviada';
    }
    return 'Revancha';
  }

  private pushSessionWinner(name: string): void {
    const n = name.trim();
    if (!n) {
      return;
    }
    this.sessionMatchHistory = [...this.sessionMatchHistory, { winnerName: n, at: Date.now() }];
  }

  private maybeRecordOnlineWinForGlobal(winnerRaw: string): void {
    if (this.onlinePlayerRole !== 1 || !this.onlineRoomId) {
      return;
    }
    const winner = winnerRaw.trim();
    if (!winner) {
      return;
    }
    const token = `${this.onlineRoomId}:${winner}:${this.sessionMatchHistory.length}`;
    if (this.onlineGlobalWinRecordedToken === token) {
      return;
    }
    this.onlineGlobalWinRecordedToken = token;
    this.api.recordGameWon(winner).subscribe({
      next: () => this.refreshStats(true),
      error: () => {},
    });
  }

  private clearSessionMatchHistory(): void {
    this.sessionMatchHistory = [];
  }

  onlineLeaveToCrear(): void {
    this.clearPoll();
    this.winnerName = null;
    this.gameMode = 'online';
    this.clearOnlineSession();
    this.onlineGoCreate();
    this.clearError();
  }

  onlineLeaveToUnirse(): void {
    this.clearPoll();
    this.winnerName = null;
    this.gameMode = 'online';
    this.clearOnlineSession();
    this.onlineGoJoin();
    this.clearError();
  }

  private flashCopyToast(): void {
    if (this.copyToastHideTimer !== null) {
      clearTimeout(this.copyToastHideTimer);
    }
    this.copyToastVisible = true;
    this.copyToastHideTimer = setTimeout(() => {
      this.copyToastVisible = false;
      this.copyToastHideTimer = null;
    }, 2000);
  }

  private fallbackCopyToClipboard(text: string): boolean {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  beginMatch(): void {
    if (this.moveOptions.length === 0) {
      this.setError('No hay movimientos disponibles. Revisa la conexión con la API o las reglas.');
      return;
    }
    const a = this.player1Name.trim();
    const b = this.player2Name.trim();
    if (!a || !b) {
      this.setError('Escribe el nombre de ambos jugadores.');
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      this.setError('Los nombres deben ser distintos.');
      return;
    }
    const badA = validatePlayerDisplayName(a);
    if (badA) {
      this.setError(badA);
      return;
    }
    const badB = validatePlayerDisplayName(b);
    if (badB) {
      this.setError(badB);
      return;
    }
    this.round = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.roundRows = [];
    this.pendingP1 = null;
    this.pickDefaultMove();
    this.phase = 'play';
    this.clearError();
  }

  confirmMove(): void {
    if (!this.currentMove) {
      this.setError('Selecciona un movimiento.');
      return;
    }
    if (this.pendingP1 === null) {
      this.pendingP1 = this.currentMove;
      this.pickDefaultMove();
      return;
    }

    const p1 = this.pendingP1;
    const p2 = this.currentMove;
    this.pendingP1 = null;

    const outcome = this.evaluateRound(p1, p2);
    let label: string;
    if (outcome === 'p1') {
      this.p1Wins++;
      label = this.player1Name.trim();
    } else if (outcome === 'p2') {
      this.p2Wins++;
      label = this.player2Name.trim();
    } else if (outcome === 'tie') {
      label = 'Empate';
    } else {
      label = 'Sin ganador (reglas)';
    }

    this.roundRows = [...this.roundRows, { round: this.round, label }];

    if (this.p1Wins >= 3 || this.p2Wins >= 3) {
      this.winnerName = this.p1Wins >= 3 ? this.player1Name.trim() : this.player2Name.trim();
      this.pushSessionWinner(this.winnerName);
      this.phase = 'gameover';
      this.loading = true;
      this.api.recordGameWon(this.winnerName).subscribe({
        next: () => {
          this.loading = false;
          this.refreshStats(true);
        },
        error: () => {
          this.loading = false;
          this.setError('No se pudo guardar el resultado en el servidor.');
        },
      });
      return;
    }

    this.round++;
    this.pickDefaultMove();
  }

  playAgain(): void {
    this.winnerName = null;
    this.clearPoll();
    if (this.gameMode === 'online') {
      this.phase = 'online-lobby';
      this.clearOnlineSession();
    } else {
      this.player1Name = '';
      this.player2Name = '';
      this.phase = 'names';
    }
    this.clearError();
  }

  openRules(): void {
    if (this.gameMode === 'online' && this.onlinePlayerRole !== 1) {
      return;
    }
    this.rulesDraft = this.rulesFromServer();
    this.newKiller = '';
    this.newDefeated = '';
    this.phase = 'rules';
    this.clearError();
  }

  backFromRules(): void {
    this.phase = 'gameover';
    this.clearError();
  }

  addRuleRow(): void {
    const k = this.newKiller.trim();
    const d = this.newDefeated.trim();
    if (!k || !d) {
      this.setError('Indica movimiento ganador y movimiento derrotado.');
      return;
    }
    if (k.toLowerCase() === d.toLowerCase()) {
      this.setError('Un movimiento no puede derrotarse a sí mismo.');
      return;
    }
    this.rulesDraft = [...this.rulesDraft, { killer: k, defeated: d }];
    this.newKiller = '';
    this.newDefeated = '';
    this.clearError();
  }

  removeRuleRow(i: number): void {
    this.rulesDraft = this.rulesDraft.filter((_, idx) => idx !== i);
  }

  saveRules(): void {
    if (this.rulesDraft.length === 0) {
      this.setError('Añade al menos una regla.');
      return;
    }
    this.loading = true;
    this.api.replaceRules({ rules: this.rulesDraft }).subscribe({
      next: (r) => {
        this.rules = r.rules;
        this.moveOptions = this.buildMoveOptions(r.rules);
        this.pickDefaultMove();
        this.loading = false;
        this.phase = 'gameover';
        this.clearError();
      },
      error: () => {
        this.loading = false;
        this.setError('No se pudieron guardar las reglas.');
      },
    });
  }

  currentPlayerLabel(): string {
    return this.pendingP1 === null ? this.player1Name.trim() : this.player2Name.trim();
  }

  formatRoundOutcomeLabel(label: string): string {
    if (label === 'Empate' || label === 'Sin ganador (reglas)') {
      return label;
    }
    return `Ganador "${label}"`;
  }

  onlineShowMovePicker(): boolean {
    const s = this.onlineRoomState;
    if (!s || s.phase !== 'playing') {
      return false;
    }
    return !s.yourMoveSubmitted;
  }

  onlineShowWaitingOwnSubmit(): boolean {
    const s = this.onlineRoomState;
    if (!s || s.phase !== 'playing') {
      return false;
    }
    return s.yourMoveSubmitted && !s.opponentMoveSubmitted && !s.resolvedRound;
  }

  onlineShowResolved(): boolean {
    return !!this.onlineRoomState?.resolvedRound;
  }

  private clearOnlineSession(): void {
    this.onlinePlayerRole = null;
    this.onlineRoomId = '';
    this.onlineRoomState = null;
    this.onlineJoinRoomIdInput = '';
    this.onlineJoinNameInput = '';
    this.onlineGlobalWinRecordedToken = null;
    this.clearSessionMatchHistory();
  }

  private clearPoll(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startOnlineHostWaitPoll(): void {
    this.clearPoll();
    this.pollTimer = setInterval(() => {
      this.api.getRoomState(this.onlineRoomId, 1).subscribe({
        next: (s) => {
          this.onlineRoomState = s;
          if (s.opponentJoined) {
            this.clearPoll();
            this.phase = 'online-play';
            this.startOnlinePlayPoll();
          }
        },
        error: () => {},
      });
    }, 800);
  }

  private startOnlinePlayPoll(): void {
    if (!this.onlineRoomId || !this.onlinePlayerRole) {
      return;
    }
    this.clearPoll();
    const tick = () => {
      this.api.getRoomState(this.onlineRoomId, this.onlinePlayerRole!).subscribe({
        next: (s) => this.applyOnlineRoomState(s),
        error: () => {},
      });
    };
    tick();
    this.pollTimer = setInterval(tick, 800);
  }

  private applyOnlineRoomState(s: RoomState): void {
    this.onlineRoomState = s;

    if (this.phase === 'rules') {
      return;
    }

    if (s.phase === 'playing' && this.phase === 'gameover' && this.gameMode === 'online') {
      this.winnerName = null;
      this.phase = 'online-play';
      this.pickDefaultMove();
      return;
    }

    if (s.phase === 'game_over' && s.winnerName) {
      if (this.phase === 'online-play') {
        this.pushSessionWinner(s.winnerName);
        this.maybeRecordOnlineWinForGlobal(s.winnerName);
      }
      this.winnerName = s.winnerName;
      if (this.phase !== 'gameover') {
        this.phase = 'gameover';
      }
    }
  }

  private applyMoveResponse(m: MoveResponse): void {
    const base = this.onlineRoomState;
    if (m.phase === 'game_over' && m.winnerName) {
      if (this.phase === 'online-play') {
        this.pushSessionWinner(m.winnerName);
        this.maybeRecordOnlineWinForGlobal(m.winnerName);
      }
      this.winnerName = m.winnerName;
      this.phase = 'gameover';
      this.onlineRoomState = base
        ? {
            ...base,
            phase: m.phase,
            p1Wins: m.p1Wins,
            p2Wins: m.p2Wins,
            round: m.round,
            winnerName: m.winnerName,
            yourMoveSubmitted: false,
            opponentMoveSubmitted: false,
            resolvedRound: m.roundResolved,
            youWantRematch: false,
            opponentWantsRematch: false,
          }
        : null;
      return;
    }

    if (m.roundResolved) {
      this.onlineRoomState = base
        ? {
            ...base,
            p1Wins: m.p1Wins,
            p2Wins: m.p2Wins,
            round: m.round,
            phase: m.phase,
            yourMoveSubmitted: false,
            opponentMoveSubmitted: false,
            resolvedRound: m.roundResolved,
            winnerName: m.winnerName,
            youWantRematch: base.youWantRematch ?? false,
            opponentWantsRematch: base.opponentWantsRematch ?? false,
          }
        : null;
      this.pickDefaultMove();
      return;
    }

    if (m.waitingForOpponent && base) {
      this.onlineRoomState = {
        ...base,
        yourMoveSubmitted: true,
        opponentMoveSubmitted: false,
        resolvedRound: null,
      };
    }
  }

  private httpErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (typeof err.error === 'string' && err.error.length > 0) {
        return err.error;
      }
      if (err.error && typeof err.error === 'object') {
        const o = err.error as { message?: string; title?: string; detail?: string };
        if (o.detail) {
          return o.detail;
        }
        if (o.title) {
          return o.title;
        }
        if (o.message) {
          return o.message;
        }
      }
      return err.message || 'Error de red.';
    }
    return 'Error desconocido.';
  }

  private resetClassicRulesForOnlineLobbyEntry(): void {
    this.api.resetRulesToClassic().subscribe({
      next: (r) => {
        this.rules = r.rules;
        this.moveOptions = this.buildMoveOptions(r.rules);
        this.pickDefaultMove();
      },
      error: () =>
        this.setError('No se pudieron restaurar las reglas clásicas. Comprueba la conexión con la API.'),
    });
  }

  private rulesFromServer(): KillPair[] {
    return this.rules.map((x) => ({ killer: x.moveName, defeated: x.kills }));
  }

  private buildMoveOptions(list: MoveRule[]): string[] {
    const set = new Set<string>();
    for (const r of list) {
      set.add(r.moveName);
      set.add(r.kills);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  private pickDefaultMove(): void {
    if (this.moveOptions.length === 0) {
      this.currentMove = '';
      return;
    }
    if (!this.moveOptions.includes(this.currentMove)) {
      this.currentMove = this.moveOptions[0];
    }
  }

  private evaluateRound(p1Move: string, p2Move: string): 'p1' | 'p2' | 'tie' | 'none' {
    if (p1Move === p2Move) {
      return 'tie';
    }
    const killerToVictim = new Map<string, string>();
    for (const r of this.rules) {
      killerToVictim.set(r.moveName, r.kills);
    }
    const p1Beats = killerToVictim.get(p1Move);
    const p2Beats = killerToVictim.get(p2Move);
    if (p1Beats === p2Move && p2Beats === p1Move) {
      return 'none';
    }
    if (p1Beats === p2Move) {
      return 'p1';
    }
    if (p2Beats === p1Move) {
      return 'p2';
    }
    return 'none';
  }

  private setError(msg: string): void {
    this.error = msg;
  }

  private clearError(): void {
    this.error = null;
  }

  backToModeSelect(): void {
    this.clearPoll();
    this.player1Name = '';
    this.player2Name = '';
    this.gameMode = null;
    this.phase = 'intro';
    this.clearOnlineSession();
    this.clearError();
  }

  historialPanelHint(): string {
    if (this.historialView === 'global') {
      return 'Ranking acumulado en el servidor (todos los dispositivos). Se actualiza al terminar partidas y con el botón Actualizar.';
    }
    if (this.gameMode === 'online') {
      return 'Partidas ganadas en esta sesión online. Se borra al crear o unirse a otra sala.';
    }
    if (this.gameMode === 'local') {
      return 'Partidas ganadas en esta sesión en este dispositivo.';
    }
    return 'Al jugar, aquí verás las victorias de la sesión actual (este navegador).';
  }
}
