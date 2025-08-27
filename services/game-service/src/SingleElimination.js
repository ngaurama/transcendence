const TournamentBase = require('./TournamentBase');

class SingleEliminationTournament extends TournamentBase {
    constructor(tournamentId, options = {}) {
        super(tournamentId, options);
        this.bracket = [];
        this.totalRounds = 0;
    }

    async addParticipant(userId) {
        if (this.status !== 'registration') {
            throw new Error('Tournament is no longer in registration phase');
        }

        if (this.participants.length >= this.options.max_participants) {
            throw new Error('Tournament is full');
        }

        if (this.participants.some(p => p.user_id === userId)) {
            throw new Error('User already registered for this tournament');
        }

        const participant = {
            user_id: userId,
            seed: this.participants.length + 1,
            is_eliminated: false
        };

        this.participants.push(participant);
        return participant;
    }

    async startTournament() {
        if (this.status !== 'registration') {
            throw new Error('Tournament can only be started from registration phase');
        }

        if (this.participants.length < 2) {
            throw new Error('Not enough participants to start tournament');
        }

        this.totalRounds = Math.ceil(Math.log2(this.participants.length));

        this.initializeBracket();
        this.status = 'in_progress';
        this.currentRound = 1;
    }

    initializeBracket() {
        const shuffledParticipants = [...this.participants].sort(() => Math.random() - 0.5);

        const firstRoundMatches = [];
        for (let i = 0; i < shuffledParticipants.length; i += 2) {
            if (i + 1 < shuffledParticipants.length) {
                firstRoundMatches.push({
                    round: 1,
                    match_number: i / 2 + 1,
                    player1: shuffledParticipants[i].user_id,
                    player2: shuffledParticipants[i + 1].user_id,
                    winner: null,
                    status: 'pending'
                });
            } else {
                firstRoundMatches.push({
                    round: 1,
                    match_number: i / 2 + 1,
                    player1: shuffledParticipants[i].user_id,
                    player2: null,
                    winner: shuffledParticipants[i].user_id,
                    status: 'completed'
                });
            }
        }

        this.bracket = firstRoundMatches;
    }

    async advanceRound() {
        if (this.status !== 'in_progress') {
            throw new Error('Tournament is not in progress');
        }
        const currentRoundMatches = this.bracket.filter(m => m.round === this.currentRound);
        const incompleteMatches = currentRoundMatches.filter(m => m.status !== 'completed');

        if (incompleteMatches.length > 0) {
            throw new Error('Not all matches in current round are completed');
        }
        if (this.currentRound === this.totalRounds) {
            this.status = 'completed';
            return;
        }

        const nextRound = this.currentRound + 1;
        const winners = currentRoundMatches.map(m => m.winner);

        const nextRoundMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
            if (i + 1 < winners.length) {
                nextRoundMatches.push({
                    round: nextRound,
                    match_number: i / 2 + 1,
                    player1: winners[i],
                    player2: winners[i + 1],
                    winner: null,
                    status: 'pending'
                });
            } else {
                nextRoundMatches.push({
                    round: nextRound,
                    match_number: i / 2 + 1,
                    player1: winners[i],
                    player2: null,
                    winner: winners[i],
                    status: 'completed'
                });
            }
        }

        this.bracket = [...this.bracket, ...nextRoundMatches];
        this.currentRound = nextRound;
    }

    async recordMatchResult(matchId, winnerId) {
        const match = this.bracket.find(m => m.id === matchId);
        if (!match) {
            throw new Error('Match not found');
        }

        if (match.status === 'completed') {
            throw new Error('Match already completed');
        }

        if (match.player1 !== winnerId && match.player2 !== winnerId) {
            throw new Error('Winner must be one of the match participants');
        }

        match.winner = winnerId;
        match.status = 'completed';

        const loserId = match.player1 === winnerId ? match.player2 : match.player1;
        if (loserId) {
            const participant = this.participants.find(p => p.user_id === loserId);
            if (participant) {
                participant.is_eliminated = true;
                participant.eliminated_in_round = match.round;
            }
        }

        if (this.currentRound === this.totalRounds) {
            this.status = 'completed';
        }
    }

    getBracket() {
        return {
            tournamentId: this.tournamentId,
            status: this.status,
            currentRound: this.currentRound,
            totalRounds: this.totalRounds,
            participants: this.participants,
            matches: this.bracket
        };
    }
}

module.exports = SingleEliminationTournament;
