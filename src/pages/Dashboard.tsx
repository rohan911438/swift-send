import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BalanceCard } from '@/components/BalanceCard';
import { TransactionItem } from '@/components/TransactionItem';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { transactions } from '@/data/mockData';
import { Send, Plus, Bell, ArrowRight, Shield, Info, Zap, Clock, TrendingDown } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const recentTransactions = transactions.slice(0, 3);
  const isNewUser = user?.createdAt && 
    new Date().getTime() - new Date(user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000; // 7 days

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="text-xl font-bold text-foreground">
              {user?.name?.split(' ')[0] || 'User'}
            </h1>
          </div>
          <button className="relative p-3 rounded-xl bg-card shadow-card hover:bg-secondary transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
          </button>
        </div>
      </header>

      <main className="px-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* New User Welcome Message */}
          {isNewUser && (
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Your personal wallet is ready! 
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Your funds are secure in your personal account. Add money to start sending globally.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => {}}>
                    Add Funds to Start
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Balance Card */}
          <BalanceCard 
            usdcBalance={user?.usdcBalance || 0}
            localCurrency={user?.localCurrency || 'USD'}
            exchangeRate={user?.exchangeRate || 1.0}
          />

          {/* Value Propositions */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Zap, label: 'Instant', desc: 'Transfers in seconds', color: 'text-yellow-600' },
              { icon: TrendingDown, label: 'Low Cost', desc: '$0.50 avg fee', color: 'text-green-600' },
              { icon: Shield, label: 'Secure', desc: 'Bank-grade safety', color: 'text-blue-600' },
            ].map(({ icon: Icon, label, desc, color }) => (
              <div
                key={label}
                className="bg-card rounded-xl p-3 shadow-card text-center animate-slide-up"
              >
                <div className={`w-8 h-8 mx-auto rounded-lg bg-muted flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="font-semibold text-xs text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
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
                onClick={() => {}}
              >
                <Plus className="w-5 h-5" />
                Add Funds
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-14"
                onClick={() => navigate('/history')}
              >
                <Clock className="w-5 h-5" />
                View History
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-card rounded-xl p-4 shadow-card">
            <h3 className="font-semibold text-foreground mb-3">This Month</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">$850</p>
                <p className="text-xs text-muted-foreground">Total Sent</p>
              </div>
              <div className="border-x border-border">
                <p className="text-2xl font-bold text-success">$2.50</p>
                <p className="text-xs text-muted-foreground">Fees Saved</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">12</p>
                <p className="text-xs text-muted-foreground">Transfers</p>
              </div>
            </div>
          </div>

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
              {recentTransactions.length > 0 ? (
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
          </div>

          {/* Trust Indicators */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Your Money is Safe</h3>
                <p className="text-sm text-muted-foreground">
                  USDC is a regulated stablecoin backed 1:1 by US dollars. Your funds are secured with bank-grade encryption in your personal wallet.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
