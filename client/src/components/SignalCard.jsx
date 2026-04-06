/**
 * AXIOM — Signal Card enrichi (Module 6)
 * Affiche le signal complet : verdict, technique, fondamental, niveaux.
 */

import React, { useState } from 'react';

const C = {
  bg: 'var(--bg)',
  panel: 'var(--bg2)',
  bg3: 'var(--bg3)',
  border: 'var(--border)',
  green: 'var(--green)',
  green2: 'var(--green2)',
  red: 'var(--red)',
  yellow: 'var(--yellow)',
  blue: 'var(--blue)',
  purple: 'var(--purple)',
  muted: 'var(--text3)',
  text: 'var(--text)',
  text2: 'var(--text2)',
};

/** Retourne la couleur en fonction de la recommandation */
function recoColor(reco) {
  if (!reco) return C.muted;
  const r = reco.toUpperCase();
  if (r.includes('ENTRER')) return C.green;
  if (r.includes('ATTENDRE')) return C.yellow;
  return C.red;
}

/** Badge de conviction 1-10 */
function ConvictionBadge({ value }) {
  const n = typeof value === 'number' ? value : parseInt(value);
  const color = n >= 8 ? C.green : n >= 5 ? C.yellow : C.red;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: color + '20', border: `1px solid ${color}40`,
      padding: '2px 8px', fontSize: 11, color,
    }}>
      🔥 {n}/10
    </div>
  );
}

/** Badge recommandation */
function RecoBadge({ reco }) {
  if (!reco) return null;
  const r = reco.toUpperCase();
  const isEntrer = r.includes('ENTRER');
  const isAttendre = r.includes('ATTENDRE');
  const emoji = isEntrer ? '✅' : isAttendre ? '⚠️' : '❌';
  const color = recoColor(reco);
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: color + '15', border: `1px solid ${color}40`,
      padding: '4px 12px', fontSize: 12, color, fontWeight: 600,
    }}>
      {emoji} {reco}
    </div>
  );
}

/** Ligne de donnée */
function DataRow({ label, value, color }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0', borderBottom: `1px solid ${C.border}`,
      fontSize: 11,
    }}>
      <span style={{ color: C.muted, letterSpacing: 1, fontSize: 10 }}>{label}</span>
      <span style={{ color: color || C.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

/** Étoiles de consensus analystes */
function AnalystStars({ score }) {
  if (!score) return <span style={{ color: C.muted }}>N/A</span>;
  const stars = Math.round(score);
  return (
    <span>
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
      <span style={{ color: C.muted, marginLeft: 4, fontSize: 10 }}>({score}/5)</span>
    </span>
  );
}

/** Badge rouge si earnings proches */
function EarningsBadge({ days }) {
  if (!days && days !== 0) return null;
  const urgent = days >= 0 && days <= 5;
  return (
    <span style={{
      background: urgent ? C.red + '20' : 'transparent',
      border: urgent ? `1px solid ${C.red}40` : 'none',
      color: urgent ? C.red : C.text2,
      padding: urgent ? '1px 6px' : '0',
      fontSize: 10,
      fontWeight: urgent ? 700 : 400,
    }}>
      {days < 0 ? 'passé' : `dans ${days}j`}
      {urgent && ' ⚠️'}
    </span>
  );
}

/**
 * Composant principal SignalCard.
 * @param {Object} signal - Données du signal (peut inclure champs fondamentaux)
 * @param {Function} onDeepDive - Callback pour analyse approfondie
 * @param {Function} onLogTrade - Callback pour logguer un trade
 */
export default function SignalCard({ signal, rank, onDeepDive, onLogTrade }) {
  const [expanded, setExpanded] = useState(false);

  const {
    ticker = '?',
    signal: dir = 'LONG',
    direction,
    timeframe = '',
    conviction = 0,
    entryZone = '',
    stopLoss = '',
    target1 = '',
    target2 = '',
    riskReward = '',
    catalyst = '',
    technicalSetup = '',
    volumeContext = '',
    invalidationNote = '',
    urgency = 'MEDIUM',
    thesis = '',
    warning = '',
    // Champs Module 6
    recommandation = '',
    phraseVerdict = '',
    rsi = null,
    macd = null,
    ratioVolume = null,
    ema20 = null,
    ema50 = null,
    ema200 = null,
    tendance = '',
    pe = null,
    revenueGrowth = null,
    freeCashFlow = null,
    consensusScore = null,
    consensusLabel = '',
    nbAnalystes = null,
    beta = null,
    daysToEarnings = null,
    earningsDate = null,
    quantite = null,
    montantRisque = null,
    // Fondamentaux enrichis
    fundamentals = null,
    technicals = null,
  } = signal;

  // Fusionner les données fondamentales si disponibles
  const fund = fundamentals || {};
  const tech = technicals || {};

  const finalRSI = rsi || tech.rsi;
  const finalRatioVol = ratioVolume || tech.ratioVolume;
  const finalEma20 = ema20 || tech.ema20;
  const finalEma50 = ema50 || tech.ema50;
  const finalEma200 = ema200 || tech.ema200;
  const finalTendance = tendance || tech.tendance;
  const finalPE = pe || fund.peForward || fund.peTtm;
  const finalGrowth = revenueGrowth || fund.revenueGrowth;
  const finalFCF = freeCashFlow || fund.freeCashFlow;
  const finalConsensus = consensusScore || fund.consensusScore;
  const finalConsensusLabel = consensusLabel || fund.consensusLabel;
  const finalNbAnalystes = nbAnalystes || fund.nbAnalystes;
  const finalBeta = beta || fund.beta;
  const finalDaysToEarnings = daysToEarnings ?? fund.daysToEarnings;
  const finalEarningsDate = earningsDate || fund.earningsDate;

  const hasExtended = !!(recommandation || phraseVerdict || finalRSI || finalPE);
  const convictionNum = Math.round(typeof conviction === 'number' ? conviction / 10 : parseInt(conviction));

  const dirColor = (dir === 'LONG' || direction === 'LONG') ? C.green : C.red;
  const urgencyColor = urgency === 'HIGH' ? C.red : urgency === 'MEDIUM' ? C.yellow : C.muted;

  const verdictBg = recommandation?.includes('ENTRER') ? '#E8F5E9' :
                    recommandation?.includes('ATTENDRE') ? '#FFF8E1' : '#FFEBEE';

  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      padding: 0,
      overflow: 'hidden',
      animation: 'fadeUp 0.3s ease forwards',
    }}>
      {/* Verdict (Module 6) */}
      {phraseVerdict && (
        <div style={{
          background: verdictBg,
          padding: '10px 16px',
          fontSize: 11,
          color: '#333',
          fontStyle: 'italic',
          lineHeight: 1.5,
          borderBottom: `1px solid ${C.border}`,
        }}>
          💡 {phraseVerdict}
        </div>
      )}

      <div style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {rank && (
              <span style={{ fontSize: 11, color: C.muted, fontFamily: 'Bebas Neue, cursive', letterSpacing: 2 }}>
                #{rank}
              </span>
            )}
            <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 24, letterSpacing: 4, color: C.text }}>{ticker}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '2px 8px',
              background: dirColor + '20', color: dirColor, border: `1px solid ${dirColor}40`,
            }}>
              {dir || direction}
            </span>
            {urgency && (
              <span style={{ fontSize: 9, color: urgencyColor, letterSpacing: 1 }}>
                ● {urgency}
              </span>
            )}
          </div>
          <ConvictionBadge value={convictionNum || Math.round(conviction / 10)} />
        </div>

        {/* Recommandation */}
        {recommandation && (
          <div style={{ marginBottom: 12 }}>
            <RecoBadge reco={recommandation} />
          </div>
        )}

        {/* Contenu étendu (Module 6) */}
        {hasExtended ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {/* Colonne Technique */}
            <div style={{ background: C.bg3, padding: 12 }}>
              <div style={{ fontSize: 10, color: C.blue, letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>
                ── TECHNIQUE
              </div>
              <DataRow label="Setup" value={technicalSetup || ''} />
              <DataRow label="Tendance" value={finalTendance} />
              {finalEma20 && <DataRow label="EMA 20" value={finalEma20?.toFixed(2)} />}
              {finalEma50 && <DataRow label="EMA 50" value={finalEma50?.toFixed(2)} />}
              {finalEma200 && <DataRow label="EMA 200" value={finalEma200?.toFixed(2)} />}
              {finalRSI && <DataRow label="RSI 14" value={finalRSI}
                color={finalRSI > 70 ? C.red : finalRSI < 30 ? C.green : C.text} />}
              {finalRatioVol && <DataRow label="Volume ratio" value={`×${finalRatioVol}`}
                color={finalRatioVol >= 1.5 ? C.green : C.text} />}
            </div>

            {/* Colonne Fondamental */}
            <div style={{ background: C.bg3, padding: 12 }}>
              <div style={{ fontSize: 10, color: C.purple, letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>
                ── FONDAMENTAL
              </div>
              {finalPE != null && <DataRow label="P/E forward" value={finalPE?.toFixed(1)}
                color={finalPE > 40 ? C.red : finalPE > 25 ? C.yellow : C.green} />}
              {finalGrowth != null && <DataRow label="Croissance rev." value={`${finalGrowth?.toFixed(1)}%`}
                color={finalGrowth > 10 ? C.green : finalGrowth > 0 ? C.text : C.red} />}
              {finalFCF != null && (
                <DataRow label="Free Cash Flow"
                  value={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', notation: 'compact' }).format(finalFCF)}
                  color={finalFCF > 0 ? C.green : C.red} />
              )}
              {finalBeta != null && <DataRow label="Beta" value={finalBeta?.toFixed(2)}
                color={finalBeta > 3 ? C.red : C.text} />}
              {finalConsensus != null && (
                <div style={{ padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>
                    Analystes ({finalNbAnalystes || '?'})
                  </div>
                  <AnalystStars score={finalConsensus} />
                </div>
              )}
              {finalDaysToEarnings != null && (
                <div style={{ padding: '4px 0' }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>Earnings</div>
                  <EarningsBadge days={finalDaysToEarnings} />
                  {finalEarningsDate && (
                    <span style={{ fontSize: 9, color: C.muted, marginLeft: 6 }}>
                      {new Date(finalEarningsDate).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Niveaux */}
        <div style={{
          background: C.bg3,
          padding: '10px 12px',
          marginBottom: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 8,
        }}>
          {entryZone && <LevelItem label="ENTRÉE" value={entryZone} color={C.blue} />}
          {stopLoss && <LevelItem label="STOP" value={stopLoss} color={C.red} />}
          {target1 && <LevelItem label="TP1" value={target1} color={C.green} />}
          {target2 && <LevelItem label="TP2" value={target2} color={C.green2 || C.green} />}
          {riskReward && <LevelItem label="R:R" value={riskReward} color={C.text} />}
          {quantite && <LevelItem label="TAILLE" value={`${quantite} act.`} color={C.text2} />}
        </div>

        {/* Catalyst */}
        {catalyst && (
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 10, lineHeight: 1.5 }}>
            <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1, display: 'block', marginBottom: 3 }}>CATALYSEUR</span>
            {catalyst}
          </div>
        )}

        {/* Expandable thesis */}
        {thesis && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none', border: 'none', color: C.blue,
                fontSize: 10, letterSpacing: 1, cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace', padding: '4px 0',
              }}
            >
              {expanded ? '▲ MASQUER ANALYSE' : '▼ VOIR ANALYSE COMPLÈTE'}
            </button>
            {expanded && (
              <div style={{
                marginTop: 8, fontSize: 11, color: C.text2,
                background: C.bg3, padding: 12, lineHeight: 1.7,
                whiteSpace: 'pre-wrap', fontFamily: 'IBM Plex Mono, monospace',
              }}>
                {thesis}
              </div>
            )}
          </div>
        )}

        {/* Warning */}
        {warning && (
          <div style={{
            fontSize: 10, color: C.yellow,
            padding: '6px 10px',
            border: `1px solid ${C.yellow}40`,
            background: C.yellow + '10',
            marginBottom: 10,
          }}>
            ⚠ {warning}
          </div>
        )}

        {/* Invalidation */}
        {invalidationNote && (
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, letterSpacing: 0.5 }}>
            <span style={{ color: C.red }}>✗</span> INVALIDATION : {invalidationNote}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {onDeepDive && (
            <button
              onClick={() => onDeepDive(ticker)}
              style={{
                flex: 1, background: 'transparent', border: `1px solid ${C.blue}`,
                color: C.blue, padding: '7px 12px', fontSize: 10, letterSpacing: 1,
                cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
                textTransform: 'uppercase',
              }}
            >
              ⊕ DEEP DIVE
            </button>
          )}
          {onLogTrade && (
            <button
              onClick={() => onLogTrade({ ticker, direction: dir, entryZone, stopLoss, target1, target2, riskReward })}
              style={{
                flex: 1, background: C.green + '15', border: `1px solid ${C.green}`,
                color: C.green, padding: '7px 12px', fontSize: 10, letterSpacing: 1,
                cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
                textTransform: 'uppercase',
              }}
            >
              + TRADE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LevelItem({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: color || C.text, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
