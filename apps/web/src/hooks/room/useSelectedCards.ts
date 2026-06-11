/**
 * 文件说明：统一管理房间中的选牌状态，以及手牌同步后的选中兜底。
 */
"use client";

import { useCallback, useState } from "react";
import type { PublicGameState } from "@lie/shared";

export function useSelectedCards() {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const clearSelectedCards = useCallback(() => {
    setSelectedCardIds([]);
  }, []);

  const toggleCard = useCallback((cardId: string) => {
    setSelectedCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      if (current.length >= 4) {
        return current;
      }

      return [...current, cardId];
    });
  }, []);

  const setCardSelected = useCallback((cardId: string, selected: boolean) => {
    setSelectedCardIds((current) => {
      const alreadySelected = current.includes(cardId);

      if (!selected) {
        return alreadySelected ? current.filter((id) => id !== cardId) : current;
      }

      if (alreadySelected || current.length >= 4) {
        return current;
      }

      return [...current, cardId];
    });
  }, []);

  const reconcileSelectedCards = useCallback((nextState: PublicGameState) => {
    setSelectedCardIds((current) => current.filter((cardId) => nextState.selfHand.some((card) => card.id === cardId)));
  }, []);

  return {
    selectedCardIds,
    setSelectedCardIds,
    clearSelectedCards,
    toggleCard,
    setCardSelected,
    reconcileSelectedCards,
  };
}
