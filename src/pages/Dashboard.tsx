import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BalanceCard } from '@/components/BalanceCard';
import { TransactionItem } from '@/components/TransactionItem';
import { BottomNav } from '@/components/BottomNav';
import WalletConnectionDialog, { WalletStatusIndicator, WalletBalanceCard } from '@/components/WalletConnection';
import { WalletTransactionHistory } from '@/components/TransactionSigning';
import { ComplianceDashboard } from '@/components/ComplianceDashboard';
import { NotificationFeed } from '@/components/NotificationFeed';
import { SpendingInsightsCard } from '@/components/SpendingInsightsCard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { transactions } from '@/data/mockData';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Send, Plus, Bell, ArrowRight, Shield, Info, Zap, Clock, TrendingDown, Star, CheckCircle2, Globe2, Award, Wallet, ExternalLink, MapPin } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connectionState } = useWallet();
  const { rates } = useExchangeRate();
  const currentExchangeRate = rates[user?.localCurrency || 'USD'] || 1.0;

  const recentTransactions = transactionsQuery.data || [];
  const unreadNotifications = notificationsQuery.data?.unreadCount || 0;
  const isNewUser = user?.createdAt && 
    new Date().getTime() - new Date(user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000; // 7 days

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground">Welcome back,</p>
              <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                <span className="text-xs font-medium text-green-800 dark:text-green-200">Verified</span>
              </div>
              <WalletStatusIndicator />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1">
              {user?.name?.split(' ')[0] || 'User'}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-blue-500" />
                <span>Stellar Network</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-green-500" />
                <span>FDIC Protected</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              className="relative p-3 rounded-xl bg-card shadow-card hover:bg-secondary transition-colors"
              onClick={() => navigate('/history')}
            >
              <Bell className="w-5 h-5 text-foreground" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="px-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* New User Welcome Message */}
          {isNewUser && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <Award className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Your account is fully verified and ready
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Send USDC globally on the Stellar network with institutional-grade security and near-instant settlement.
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      <span>3-5 sec transfers</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-green-500" />
                      <span>$250k FDIC insurance</span>
                    </div>
                  </div>
                  <Button variant="default" size="sm" onClick={() => navigate('/send')}>
                    Send Your First Transfer
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Balance Card */}
          <BalanceCard 
            usdcBalance={user?.usdcBalance || 0}
            localCurrency={user?.localCurrency || 'USD'}
            exchangeRate={currentExchangeRate}
          />

          {/* Compliance Dashboard - Compact View */}
          <ComplianceDashboard compact={true} showUpgradePrompt={true} />

          <SpendingInsightsCard
            insights={insightsQuery.data?.summary}
            isLoading={insightsQuery.isLoading}
          />

          <NotificationFeed
            notifications={notificationsQuery.data?.items || []}
            unreadCount={unreadNotifications}
          />

          {/* How It Works - Brief Overview */}
          {isNewUser && (
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">
                    Complete Remittance Solution
                  </h3>
                </div>
                <p className="text-sm text-indigo-700 dark:text-indigo-200 mb-4">
                  We handle the entire journey - from adding cash to your account to cash pickup by your recipient.
                </p>
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div>
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mx-auto mb-1">
                      <Plus className="w-3 h-3 text-indigo-600" />
                    </div>
                    <p className="font-medium text-indigo-900 dark:text-indigo-100">Add Cash</p>
                  </div>
                  <div>
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mx-auto mb-1">
                      <Zap className="w-3 h-3 text-indigo-600" />
                    </div>
                    <p className="font-medium text-indigo-900 dark:text-indigo-100">Send Fast</p>
                  </div>
                  <div>
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mx-auto mb-1">
                      <MapPin className="w-3 h-3 text-indigo-600" />
                    </div>
                    <p className="font-medium text-indigo-900 dark:text-indigo-100">Cash Pickup</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                  onClick={() => navigate('/remittance')}
                >
                  Learn How It Works
                </Button>
              </CardContent>
            </Card>
          )}

          {/* External Wallet Section */}
          {connectionState.isConnected ? (
            <WalletBalanceCard />
          ) : (
            <div className="p-4 border border-dashed border-primary/30 rounded-xl bg-primary/5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    Connect Your Stellar Wallet
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    For advanced users who want full control over their private keys and enhanced transparency.
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-green-500" />
                      <span>Self-custody</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 text-blue-500" />
                      <span>On-chain visibility</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowWalletDialog(true)}
                  >
                    <Wallet className="w-4 h-4" />
                    Connect Wallet
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Stellar Network Status */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-foreground">Stellar Network Online</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>99.99% Uptime</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <Zap className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">3-5 Sec</p>
                <p className="text-xs text-muted-foreground">Settlement</p>
              </div>
              <div className="text-center border-x border-border px-2">
                <TrendingDown className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">$0.01</p>
                <p className="text-xs text-muted-foreground">Network Fee</p>
              </div>
              <div className="text-center">
                <Globe2 className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">190+</p>
                <p className="text-xs text-muted-foreground">Countries</p>
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="space-y-3">
            <Button
              variant="hero"
              size="lg"
              className="w-full h-16 text-lg font-semibold"
              onClick={() => navigate('/send')}
            >
              <Send className="w-6 h-6" />
              Send Money
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="h-14"
                onClick={() => navigate('/add-funds')}
              >
                <Plus className="w-5 h-5" />
                Add Funds
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-14"
                onClick={() => navigate('/withdraw')}
              >
                <ArrowRight className="w-5 h-5" />
                Cash Out
              </Button>
            </div>
            
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/history')}
            >
              <Clock className="w-4 h-4 mr-2" />
              View Transaction History
            </Button>
          </div>

          {/* Quick Remittance Options */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Complete Remittance Solution
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-200 mb-4">
                From cash to cash - we handle the entire journey for your recipients
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Add Cash</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Bank, Card, or Cash</p>
                </div>
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Send Fast</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Stellar Network</p>
                </div>
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Cash Pickup</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">20,000+ Locations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
              <button
                onClick={() => navigate('/history')}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                See all
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {transactionsQuery.isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 rounded-xl bg-muted animate-pulse" />
                ))
              ) : recentTransactions.length > 0 ? (
                recentTransactions.map((transaction) => (
                  <TransactionItem
                    key={transaction.id}
                    transaction={transaction}
                    onClick={() => {}}
                  />
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                    <Send className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Ready to send money?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your wallet is set up and ready for global transfers
                  </p>
                  <Button onClick={() => navigate('/send')} variant="outline">
                    Send Your First Transfer
                  </Button>
                </div>
              )}
            </div>

            {transactionsQuery.isError && (
              <p className="mt-3 text-sm text-destructive">
                We couldn&apos;t load recent transactions right now.
              </p>
            )}
          </div>

          {/* Regulatory Compliance & Trust */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Institutional-Grade Security</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>USDC fully reserved and regulated by Centre Consortium</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Stellar network secured by global validator network</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Customer funds protected up to $250,000 FDIC insurance</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 text-xs text-muted-foreground">
                  Licensed money transmitter • SOC 2 Type II compliant • Anti-money laundering (AML) monitoring
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Transaction History */}
          {connectionState.isConnected && (
            <WalletTransactionHistory />
          )}
        </div>
      </main>

      <BottomNav />

      {/* Wallet Connection Dialog */}
      <WalletConnectionDialog
        isOpen={showWalletDialog}
        onClose={() => setShowWalletDialog(false)}
        onConnect={() => {
          // Optionally show success message or update UI
        }}
      />
    </div>
  );
}
