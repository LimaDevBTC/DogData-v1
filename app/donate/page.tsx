"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Heart, 
  Copy, 
  Check, 
  Bitcoin, 
  Coins, 
  Zap,
  ArrowLeft,
  Shield,
  Users,
  Star
} from "lucide-react"
import { SectionDivider } from "@/components/ui/section-divider"
import Image from "next/image"

const DONATION_ADDRESSES = {
  bitcoin: "bc1qkq43gqyr7gjzj0mxz0v7e0nzs3cm59g9jspc63",
  dog: "bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p",
  stacks: "SP18DX0ANJTAA3WWWA501QHR27J76KPGV9MQ0J01Y"
}

export default function DonatePage() {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<'bitcoin' | 'dog' | 'stacks' | null>(null)

  const copyToClipboard = async (address: string, method: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(method)
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }


  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="p-6 text-center space-y-6">
        <div className="flex items-center justify-center space-x-4">
          <Heart className="w-12 h-12 text-red-500 animate-pulse" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-red-400 via-pink-500 to-red-600 bg-clip-text text-transparent font-mono">
            Support DOG Community
          </h1>
        </div>
        
        <div className="max-w-4xl mx-auto space-y-6">
          <p className="text-xl text-gray-300 font-mono leading-relaxed">
            Help us build the future of Bitcoin runes and ordinal technology. 
            Your support powers our research, development, and community initiatives.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="flex items-center justify-center space-x-2 text-green-400">
              <Shield className="w-5 h-5" />
              <span className="font-mono text-sm">Secure & Transparent</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-blue-400">
              <Users className="w-5 h-5" />
              <span className="font-mono text-sm">Community Driven</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-yellow-400">
              <Star className="w-5 h-5" />
              <span className="font-mono text-sm">Open Source</span>
            </div>
          </div>
        </div>
      </div>

      <SectionDivider title="Choose Your Donation Method" icon={Heart} />

      {/* Donation Methods */}
      <div className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Bitcoin Donation */}
          <Card variant="glass" className="border-orange-500/20 hover:border-orange-500/40 transition-all">
            <CardHeader>
              <CardTitle className="text-orange-400 text-xl flex items-center">
                <Bitcoin className="w-6 h-6 mr-3" />
                Bitcoin (BTC)
              </CardTitle>
              <p className="text-gray-400 text-sm font-mono">
                Support with Bitcoin
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-gray-700">
                <div className="text-xs text-gray-400 font-mono mb-2">Address:</div>
                <div className="font-mono text-sm break-all text-gray-300">
                  {DONATION_ADDRESSES.bitcoin}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(DONATION_ADDRESSES.bitcoin, 'bitcoin')}
                className="w-full btn-sharp"
              >
                {copiedAddress === 'bitcoin' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </>
                )}
              </Button>

              <div className="text-center">
                <div className="rounded-lg overflow-hidden">
                  <Image
                    src="/qrbtc.jpeg"
                    alt="Bitcoin QR Code"
                    width={250}
                    height={250}
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-gray-400 font-mono mt-2">Scan to donate</p>
              </div>
            </CardContent>
          </Card>

          {/* DOG Donation */}
          <Card variant="glass" className="border-orange-500/20 hover:border-orange-500/40 transition-all">
            <CardHeader>
              <CardTitle className="text-orange-400 text-xl flex items-center">
                <Coins className="w-6 h-6 mr-3" />
                DOG Rune
              </CardTitle>
              <p className="text-gray-400 text-sm font-mono">
                Support with DOG
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-gray-700">
                <div className="text-xs text-gray-400 font-mono mb-2">Address:</div>
                <div className="font-mono text-sm break-all text-gray-300">
                  {DONATION_ADDRESSES.dog}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(DONATION_ADDRESSES.dog, 'dog')}
                className="w-full btn-sharp"
              >
                {copiedAddress === 'dog' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </>
                )}
              </Button>

              <div className="text-center">
                <div className="rounded-lg overflow-hidden">
                  <Image
                    src="/qrdog.jpeg"
                    alt="DOG QR Code"
                    width={250}
                    height={250}
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-gray-400 font-mono mt-2">Scan to donate</p>
              </div>
            </CardContent>
          </Card>

          {/* Stacks Donation */}
          <Card variant="glass" className="border-orange-500/20 hover:border-orange-500/40 transition-all">
            <CardHeader>
              <CardTitle className="text-orange-400 text-xl flex items-center">
                <Zap className="w-6 h-6 mr-3" />
                Stacks (STX)
              </CardTitle>
              <p className="text-gray-400 text-sm font-mono">
                Support with Stacks
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-gray-700">
                <div className="text-xs text-gray-400 font-mono mb-2">Address:</div>
                <div className="font-mono text-sm break-all text-gray-300">
                  {DONATION_ADDRESSES.stacks}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(DONATION_ADDRESSES.stacks, 'stacks')}
                className="w-full btn-sharp"
              >
                {copiedAddress === 'stacks' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </>
                )}
              </Button>

              <div className="text-center">
                <div className="rounded-lg overflow-hidden">
                  <Image
                    src="/qrstx.jpeg"
                    alt="Stacks QR Code"
                    width={250}
                    height={250}
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-gray-400 font-mono mt-2">Scan to donate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Impact Section */}
        <div className="mt-16 text-center space-y-8">
          <h2 className="text-3xl font-bold text-white font-mono">
            Your Impact
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="glass" className="border-orange-500/20">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-orange-400 font-mono mb-2">
                  Research
                </div>
                <p className="text-gray-400 font-mono text-sm">
                  Advanced Bitcoin rune analytics and ordinal technology research
                </p>
              </CardContent>
            </Card>

            <Card variant="glass" className="border-orange-500/20">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-orange-400 font-mono mb-2">
                  Development
                </div>
                <p className="text-gray-400 font-mono text-sm">
                  Open-source tools and infrastructure for the DOG ecosystem
                </p>
              </CardContent>
            </Card>

            <Card variant="glass" className="border-orange-500/20">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-orange-400 font-mono mb-2">
                  Community
                </div>
                <p className="text-gray-400 font-mono text-sm">
                  Educational content and community building initiatives
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="max-w-2xl mx-auto">
            <p className="text-gray-300 font-mono text-lg leading-relaxed">
              Every donation, no matter the size, helps us continue building tools 
              that benefit the entire Bitcoin and DOG community. Thank you for your support! 🙏
            </p>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-12 text-center">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="btn-sharp"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
