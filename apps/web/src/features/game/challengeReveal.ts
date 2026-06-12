/**
 * @Description: 质疑结算后的弃牌翻开和回收飞牌数据转换工具。
 *
 * @Date 2026-06-12 14:47
 */
import type { PublicGameEvent } from "@lie/shared";
import type { ChallengeResolvedGameEvent, DisplayDiscardCard, ReturnFlightCard } from "./gameTableTypes";

export function getLatestChallengeResolvedEvent(events: PublicGameEvent[], turnSeq: number) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event.type === "challenge_resolved" && event.turnSeq === turnSeq) {
      return event;
    }
  }

  return null;
}

export function revealDiscardCards(cards: DisplayDiscardCard[], event: ChallengeResolvedGameEvent | null): DisplayDiscardCard[] {
  if (!event) {
    return cards;
  }

  const revealedTurnSeq = event.turnSeq - 1;
  const exactRevealIndexes = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.turnSeq === revealedTurnSeq && card.playedByPlayerId === event.challengedPlayerId)
    .map(({ index }) => index);
  const fallbackRevealIndexes = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.playedByPlayerId === event.challengedPlayerId)
    .slice(-event.revealedCards.length)
    .map(({ index }) => index);
  const revealIndexes = exactRevealIndexes.length === event.revealedCards.length ? exactRevealIndexes : fallbackRevealIndexes;
  const revealCardByIndex = new Map(revealIndexes.map((cardIndex, revealIndex) => [cardIndex, event.revealedCards[revealIndex]]));

  return cards.map((card, index) => {
    const revealCard = revealCardByIndex.get(index);

    if (!revealCard) {
      return card;
    }

    return {
      ...card,
      revealCard,
    };
  });
}

export function revealReturnFlights(flights: ReturnFlightCard[], event: ChallengeResolvedGameEvent | null): ReturnFlightCard[] {
  if (!event) {
    return flights;
  }

  const revealedCards = [...event.revealedCards];
  const revealedTurnSeq = event.turnSeq - 1;

  return flights.map((flight) => {
    const isRevealedFlight = flight.sourceTurnSeq === revealedTurnSeq && flight.sourcePlayedByPlayerId === event.challengedPlayerId;

    if (!isRevealedFlight) {
      return flight;
    }

    const sourceCard = revealedCards.shift();

    return sourceCard
      ? {
          ...flight,
          revealCard: sourceCard,
        }
      : flight;
  });
}
