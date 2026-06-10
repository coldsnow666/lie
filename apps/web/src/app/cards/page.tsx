/**
 * 文件说明：像素扑克牌展示页，用于预览当前 DOM 牌面和项目内牌面素材。
 */
import { createDeck, SUITS } from "@lie/shared";
import CardBackArt from "@/components/game/CardBackArt";
import DomPlayingCard from "@/components/game/DomPlayingCard";
import { SUIT_LABELS } from "@/lib/card-assets";

const deck = createDeck();
const jokers = [
  { id: "black-joker", label: "小王", color: "black", badgeClassName: "bg-[#17251f] text-[#fff6cf]" },
  { id: "red-joker", label: "大王", color: "red", badgeClassName: "bg-[#b33332] text-[#fff6cf]" },
] as const;

const previewGridClassName =
  "grid grid-cols-[repeat(auto-fill,minmax(5.8rem,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))]";
const previewCardClassName = "[--pixel-card-scale:1.9] sm:[--pixel-card-scale:2.35]";

export default function CardsPage() {
  return (
    <main className="min-h-dvh px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div className="grid gap-3">
            <p className="text-sm text-[#d7bc72]">DOM pixel poker cards</p>
            <h1 className="text-4xl font-black leading-tight text-[#fff6cf] sm:text-6xl">像素扑克牌</h1>
            <p className="max-w-2xl text-sm leading-7 text-[#c6d0bd]">
              当前展示的是项目内使用的牌面：标准牌由 DOM 绘制，JQK、大小王和牌背使用项目内的独立素材。
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[#dce7d8]">牌背预览</span>
            </div>
            <div className="mt-3 flex gap-3">
              {[0, 1, 2, 3].map((back) => (
                <CardBackArt
                  key={back}
                  back={back}
                  label={`牌背 ${back + 1}`}
                  className="[--card-back-art-width:49px] [--card-back-art-height:65px] [--card-back-scale:1.9] sm:[--card-back-scale:2.35]"
                />
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-5">
          {SUITS.map((suit) => {
            const suitCards = deck.filter((card) => card.suit === suit);

            return (
              <section key={suit} className="grid gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-[#fff6cf]">{SUIT_LABELS[suit]}</h2>
                  <span className="h-px flex-1 bg-[#5f7b75]" />
                  <span className="text-sm text-[#c6b889]">{suitCards.length} 张</span>
                </div>
                <div className={previewGridClassName}>
                  {suitCards.map((card) => (
                    <div key={card.id} className="grid place-items-center">
                      <DomPlayingCard card={card} className={previewCardClassName} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="grid gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[#fff6cf]">王牌</h2>
              <span className="h-px flex-1 bg-[#5f7b75]" />
              <span className="text-sm text-[#c6b889]">2 张</span>
            </div>
            <div className={previewGridClassName}>
              {jokers.map((joker) => (
                <div key={joker.id} className="grid place-items-center gap-2">
                  <DomPlayingCard joker={joker.color} className={previewCardClassName} />
                  <span className={`w-full px-2 py-1 text-center text-xs ${joker.badgeClassName}`}>{joker.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
