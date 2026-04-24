import { useCallback, useState, useMemo } from 'react';
import { ChevronDown, Search, Filter, Calendar, Banknote, TrendingUp, Clock, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { TransactionItem } from '@/components/TransactionItem';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

const History: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [amountFilter, setAmountFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('latest');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);

  const handleGoBack = useCallback(() => {
    navigate(-1); // Go back to previous page
  }, [navigate]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const sentTransactions = user?.transactions?.filter(t => t.type === 'send') || [];
    const totalSent = sentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalFees = sentTransactions.reduce((sum, t) => sum + t.fee, 0);
    const pendingTransactions = user?.transactions?.filter(t => t.status === 'pending').length || 0;
    const thisMonth = user?.transactions?.filter(t => {
      const transactionDate = new Date(t.timestamp);
      const now = new Date();
      return transactionDate.getMonth() === now.getMonth() && 
             transactionDate.getFullYear() === now.getFullYear();
    }).length || 0;

    return { totalSent, totalFees, pendingTransactions, thisMonth };
  }, [user?.transactions]);

  // Filter transactions based on search and filters
  const filteredTransactions = useMemo(() => {
    let filtered = (user?.transactions || []).filter(transaction => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = transaction.recipientName.toLowerCase().includes(searchLower) ||
                           transaction.recipientPhone?.includes(searchTerm) ||
                           transaction.id.toLowerCase().includes(searchLower);
                           
      const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
      const matchesType = typeFilter === 'all' || transaction.type === typeFilter;
      
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const txDate = new Date(transaction.timestamp);
        const now = new Date();
        if (dateFilter === 'last7days') {
          const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
          matchesDate = txDate >= sevenDaysAgo;
        } else if (dateFilter === 'thisMonth') {
          matchesDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        } else if (dateFilter === 'thisYear') {
          matchesDate = txDate.getFullYear() === now.getFullYear();
        }
      }

      let matchesAmount = true;
      if (amountFilter !== 'all') {
        if (amountFilter === 'under50') matchesAmount = transaction.amount < 50;
        else if (amountFilter === '50to200') matchesAmount = transaction.amount >= 50 && transaction.amount <= 200;
        else if (amountFilter === 'over200') matchesAmount = transaction.amount > 200;
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesDate && matchesAmount;
    });

    filtered.sort((a, b) => {
      if (sortOrder === 'latest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sortOrder === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (sortOrder === 'highest') return b.amount - a.amount;
      if (sortOrder === 'lowest') return a.amount - b.amount;
      return 0;
    });

    return filtered;
  }, [user?.transactions, searchTerm, statusFilter, typeFilter, dateFilter, amountFilter, sortOrder]);

  const monthlyTransferData = useMemo(() => {
    const monthlyMap = new Map<string, { month: string; sent: number; received: number }>();
    (user?.transactions || []).forEach((transaction) => {
      const date = new Date(transaction.timestamp);
      const month = date.toLocaleString('en-US', { month: 'short' });
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { month, sent: 0, received: 0 });
      }
      const monthData = monthlyMap.get(month);
      if (!monthData) return;
      if (transaction.type === 'send') monthData.sent += transaction.amount;
      if (transaction.type === 'receive') monthData.received += transaction.amount;
    });

    return Array.from(monthlyMap.values()).slice(-6);
  }, [user?.transactions]);

  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    (user?.transactions || [])
      .filter((transaction) => transaction.type === 'send')
      .forEach((transaction) => {
        const category = transaction.destinationCurrency ? `${transaction.destinationCurrency} transfer` : 'General transfers';
        categoryMap.set(category, (categoryMap.get(category) ?? 0) + transaction.amount);
      });

    return Array.from(categoryMap.entries()).map(([category, value]) => ({ category, value }));
  }, [user?.transactions]);

  const handleTransactionClick = useCallback((transactionId: string) => {
    setExpandedTransactionId((currentId) => (currentId === transactionId ? null : transactionId));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFilter('all');
    setAmountFilter('all');
    setSortOrder('latest');
  }, []);

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' }
  ];

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'send', label: 'Sent' },
    { value: 'receive', label: 'Received' }
  ];

  const dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'thisYear', label: 'This Year' }
  ];

  const amountOptions = [
    { value: 'all', label: 'Any Amount' },
    { value: 'under50', label: 'Under $50' },
    { value: '50to200', label: '$50 - $200' },
    { value: 'over200', label: 'Over $200' }
  ];

  return (
    <div className="mx-auto w-full max-w-3xl bg-background min-h-screen px-3 sm:px-5 lg:px-6 pb-20">
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border/50">
        <div className="py-6 pb-4">
          {/* Header with back button */}
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleGoBack}
              className="p-2 h-auto"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Transaction History</h1>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Total Sent</span>
                </div>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">${summary.totalSent.toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">Fees Paid</span>
                </div>
                <p className="text-lg font-bold text-green-900 dark:text-green-100">${summary.totalFees.toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Pending</span>
                </div>
                <p className="text-lg font-bold text-orange-900 dark:text-orange-100">{summary.pendingTransactions}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">This Month</span>
                </div>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{summary.thisMonth}</p>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Charts */}
          <div className="grid gap-3 mb-4 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Monthly Transfers</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer
                  className="h-56 w-full"
                  config={{
                    sent: { label: 'Sent', color: '#f97316' },
                    received: { label: 'Received', color: '#16a34a' },
                  }}
                >
                  <BarChart data={monthlyTransferData}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={32} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="sent" fill="var(--color-sent)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="received" fill="var(--color-received)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer
                  className="h-56 w-full"
                  config={{
                    value: { label: 'Amount', color: '#6366f1' },
                  }}
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, item) => (
                            <div className="flex w-full items-center justify-between gap-2">
                              <span>{(item.payload as { category: string }).category}</span>
                              <span className="font-semibold">${Number(value).toFixed(2)}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie data={categoryData} dataKey="value" nameKey="category" outerRadius={80}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`${entry.category}-${index}`} fill={['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'][index % 6]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search recipients, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border/50"
            />
          </div>

          {/* Filters and Sorting */}
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span>Filters & Sort</span>
                  {(statusFilter !== 'all' || typeFilter !== 'all' || dateFilter !== 'all' || amountFilter !== 'all' || sortOrder !== 'latest') && (
                    <Badge variant="secondary" className="text-xs">
                      {[statusFilter, typeFilter, dateFilter, amountFilter].filter(f => f !== 'all').length + (sortOrder !== 'latest' ? 1 : 0)}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-3">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status & Type</p>
                <div className="flex gap-2 flex-wrap">
                  {statusOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={statusFilter === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(option.value)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {typeOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={typeFilter === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter(option.value)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Date & Amount</p>
                <div className="flex gap-2 flex-wrap">
                  {dateOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={dateFilter === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDateFilter(option.value)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {amountOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={amountFilter === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAmountFilter(option.value)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sort Order</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'latest', label: 'Latest First' },
                    { value: 'oldest', label: 'Oldest First' },
                    { value: 'highest', label: 'Highest Amount' },
                    { value: 'lowest', label: 'Lowest Amount' }
                  ].map((option) => (
                     <Button
                      key={option.value}
                      variant={sortOrder === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortOrder(option.value)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="p-6 pt-2">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || dateFilter !== 'all' || amountFilter !== 'all' || sortOrder !== 'latest' ? (
              <div className="space-y-3">
                <div className="text-4xl">🔍</div>
                <h3 className="text-lg font-semibold text-foreground">No transactions found</h3>
                <p className="text-muted-foreground text-sm">
                  Try adjusting your search or filter criteria
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-4xl">💸</div>
                <h3 className="text-lg font-semibold text-foreground">No transactions yet</h3>
                <p className="text-muted-foreground text-sm">
                  Your transaction history will appear here once you send or receive money
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </p>
              {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || dateFilter !== 'all' || amountFilter !== 'all' || sortOrder !== 'latest') && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>

            {filteredTransactions.map((transaction, index) => (
              <div key={transaction.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                <TransactionItem
                  transaction={transaction}
                  showDetailedView={expandedTransactionId === transaction.id}
                  onClick={() => handleTransactionClick(transaction.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
