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
  TiePair,
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
  tieRules: TiePair[] = [];
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
  tieDraft: TiePair[] = [];
  newComboMove = '';
  partitionChoice: Record<string, 'beats' | 'loses' | 'tie' | null> = {};

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
        this.tieRules = r.ties ?? [];
        this.moveOptions = this.buildMoveOptionsFromRulesAndTies(r.rules, this.tieRules);
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
    this.tieDraft = this.tieRules.map((x) => ({ moveA: x.moveA, moveB: x.moveB }));
    this.newComboMove = '';
    this.initPartitionChoices();
    this.phase = 'rules';
    this.clearError();
  }

  backFromRules(): void {
    this.phase = 'gameover';
    this.clearError();
  }

  existingMoveNames(): string[] {
    const s = new Set<string>();
    for (const p of this.rulesDraft) {
      const k = p.killer.trim();
      const d = p.defeated.trim();
      if (k) {
        s.add(k);
      }
      if (d) {
        s.add(d);
      }
    }
    for (const t of this.tieDraft) {
      const a = t.moveA.trim();
      const b = t.moveB.trim();
      if (a) {
        s.add(a);
      }
      if (b) {
        s.add(b);
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'));
  }

  partitionComplete(): boolean {
    const pool = this.existingMoveNames();
    if (pool.length === 0) {
      return false;
    }
    for (const name of pool) {
      const c = this.partitionChoice[name];
      if (c !== 'beats' && c !== 'loses' && c !== 'tie') {
        return false;
      }
    }
    return true;
  }

  addNewMoveWithPartition(): void {
    const pool = this.existingMoveNames();
    if (pool.length === 0) {
      this.setError('Añade primero movimientos en la tabla (o empates) para poder enlazar uno nuevo.');
      return;
    }
    if (!this.partitionComplete()) {
      this.setError('Elige para cada movimiento existente si el nuevo vence, pierde o empata.');
      return;
    }
    const m = this.newComboMove.trim();
    if (!m) {
      this.setError('Escribe el nombre del movimiento nuevo.');
      return;
    }
    const lower = (x: string) => x.toLowerCase();
    const poolLc = new Set(pool.map((x) => lower(x)));
    if (poolLc.has(lower(m))) {
      this.setError('Ese nombre de movimiento ya existe en las reglas. Elige otro nombre.');
      return;
    }

    const newKills: KillPair[] = [];
    const newTies: TiePair[] = [];

    for (const ex of pool) {
      const kind = this.partitionChoice[ex];
      if (kind === 'beats') {
        newKills.push({ killer: m, defeated: ex });
      } else if (kind === 'loses') {
        newKills.push({ killer: ex, defeated: m });
      } else if (kind === 'tie') {
        if (this.tieDraftHasPair(m, ex)) {
          this.setError(`Ya hay un empate registrado entre «${m}» y «${ex}».`);
          return;
        }
        newTies.push(this.normalizedTiePair(m, ex));
      }
    }

    let mergedKills = [...this.rulesDraft];
    for (const p of newKills) {
      const k = p.killer.trim().toLowerCase();
      const d = p.defeated.trim().toLowerCase();
      const dup = mergedKills.some(
        (x) => x.killer.trim().toLowerCase() === k && x.defeated.trim().toLowerCase() === d,
      );
      if (!dup) {
        mergedKills = [...mergedKills, p];
      }
    }
    this.rulesDraft = mergedKills;
    this.tieDraft = [...this.tieDraft, ...newTies];
    this.newComboMove = '';
    this.initPartitionChoices();
    this.clearError();
  }

  removeTieDraftRow(i: number): void {
    this.tieDraft = this.tieDraft.filter((_, idx) => idx !== i);
    this.initPartitionChoices();
  }

  removeRuleRow(i: number): void {
    this.rulesDraft = this.rulesDraft.filter((_, idx) => idx !== i);
    if (this.phase === 'rules') {
      this.initPartitionChoices();
    }
  }

  saveRules(): void {
    if (this.rulesDraft.length === 0) {
      this.setError('Añade al menos una regla.');
      return;
    }
    const graphErr = this.validateRulesGraph(this.rulesDraft);
    if (graphErr) {
      this.setError(graphErr);
      return;
    }
    this.loading = true;
    this.api.replaceRules({ rules: this.rulesDraft, ties: this.tieDraft }).subscribe({
      next: (r) => {
        this.rules = r.rules;
        this.tieRules = r.ties ?? [];
        this.moveOptions = this.buildMoveOptionsFromRulesAndTies(r.rules, this.tieRules);
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
        next: (s) => {
          this.applyOnlineRoomState(s);
          if (this.gameMode === 'online' && this.phase !== 'rules') {
            this.syncRulesFromServer();
          }
        },
        error: () => {},
      });
    };
    tick();
    this.pollTimer = setInterval(tick, 800);
  }

  private syncRulesFromServer(): void {
    this.api.getRules().subscribe({
      next: (r) => {
        this.rules = r.rules;
        this.tieRules = r.ties ?? [];
        this.moveOptions = this.buildMoveOptionsFromRulesAndTies(r.rules, this.tieRules);
        this.pickDefaultMove();
      },
      error: () => {},
    });
  }

  private validateRulesGraph(rules: KillPair[]): string | null {
    const moves = new Set<string>();
    for (const p of rules) {
      const k = p.killer.trim();
      const d = p.defeated.trim();
      if (k) {
        moves.add(k);
      }
      if (d) {
        moves.add(d);
      }
    }
    if (moves.size === 0) {
      return 'Las reglas no contienen movimientos válidos.';
    }
    for (const m of moves) {
      const winsAgainst = rules.some((p) => p.killer.trim() === m);
      const losesTo = rules.some((p) => p.defeated.trim() === m);
      if (!winsAgainst || !losesTo) {
        return `Cada movimiento debe aparecer al menos una vez como ganador y una vez como derrotado. Revisa «${m}» (falta ${!winsAgainst ? 'a quién vence' : 'quién lo vence'}).`;
      }
    }
    return null;
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
        this.tieRules = r.ties ?? [];
        this.moveOptions = this.buildMoveOptionsFromRulesAndTies(r.rules, this.tieRules);
        this.pickDefaultMove();
      },
      error: () =>
        this.setError('No se pudieron restaurar las reglas clásicas. Comprueba la conexión con la API.'),
    });
  }

  private rulesFromServer(): KillPair[] {
    return this.rules.map((x) => ({ killer: x.moveName, defeated: x.kills }));
  }

  private buildMoveOptionsFromRulesAndTies(list: MoveRule[], ties: TiePair[]): string[] {
    const set = new Set<string>();
    for (const r of list) {
      set.add(r.moveName);
      set.add(r.kills);
    }
    for (const t of ties) {
      set.add(t.moveA);
      set.add(t.moveB);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  private initPartitionChoices(): void {
    const next: Record<string, 'beats' | 'loses' | 'tie' | null> = {};
    for (const n of this.existingMoveNames()) {
      next[n] = null;
    }
    this.partitionChoice = next;
  }

  private tieDraftHasPair(a: string, b: string): boolean {
    const key = this.makeTieKey(a, b);
    return this.tieDraft.some((t) => this.makeTieKey(t.moveA, t.moveB) === key);
  }

  private normalizedTiePair(a: string, b: string): TiePair {
    const c = a.localeCompare(b, undefined, { sensitivity: 'base' });
    return c <= 0 ? { moveA: a, moveB: b } : { moveA: b, moveB: a };
  }

  private makeTieKey(a: string, b: string): string {
    const c = a.localeCompare(b, undefined, { sensitivity: 'base' });
    const lo = c <= 0 ? a : b;
    const hi = c <= 0 ? b : a;
    return `${lo.toLowerCase()}\u001f${hi.toLowerCase()}`;
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
    if (p1Move.localeCompare(p2Move, undefined, { sensitivity: 'base' }) === 0) {
      return 'tie';
    }
    const tieKey = this.makeTieKey(p1Move, p2Move);
    const tieSet = new Set(this.tieRules.map((t) => this.makeTieKey(t.moveA, t.moveB)));
    if (tieSet.has(tieKey)) {
      return 'tie';
    }

    const killerToVictims = new Map<string, Set<string>>();
    for (const r of this.rules) {
      const k = r.moveName.toLowerCase();
      if (!killerToVictims.has(k)) {
        killerToVictims.set(k, new Set<string>());
      }
      killerToVictims.get(k)!.add(r.kills.toLowerCase());
    }

    const p1 = p1Move.toLowerCase();
    const p2 = p2Move.toLowerCase();
    const v1 = killerToVictims.get(p1);
    const v2 = killerToVictims.get(p2);
    const p1beatsP2 = v1 != null && v1.has(p2);
    const p2beatsP1 = v2 != null && v2.has(p1);

    if (p1beatsP2 && p2beatsP1) {
      return 'none';
    }
    if (p1beatsP2) {
      return 'p1';
    }
    if (p2beatsP1) {
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
